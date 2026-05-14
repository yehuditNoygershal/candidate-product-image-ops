import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import AWS from "aws-sdk";
import { parse } from "csv-parse/sync";

dotenv.config();

const sqs = new AWS.SQS();

let mongoClient;

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;
const QUEUE_URL = process.env.SQS_QUEUE_URL;

/* =========================
   DB
========================= */
async function getDb() {
    console.log("[DB] getDb called");

    if (!mongoClient) {
        console.log("[DB] Creating new MongoClient connection");
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
        console.log("[DB] Mongo connected successfully");
    }

    return mongoClient.db(DB_NAME);
}

/* =========================
   URL NORMALIZER
========================= */
function normalizeUrl(url) {
    console.log("[normalizeUrl] input:", url);

    if (!url || typeof url !== "string") return "";

    try {
        const u = new URL(url.trim());

        // Normalize domain to lowercase
        u.hostname = u.hostname.toLowerCase();

        // Remove trailing slashes from pathname
        u.pathname = u.pathname.replace(/\/+$/, "");

        const result = u.toString();
        console.log("[normalizeUrl] output:", result);

        return result;

    } catch (err) {
        console.log("[normalizeUrl] failed, returning raw trimmed URL");
        return url.trim();
    }
}

/* =========================================================
   ROUTER
========================================================= */
export const handler = async (event) => {
    const method = event.requestContext?.http?.method;
    const path = event.requestContext?.http?.path;

    console.log("[HANDLER] Incoming request:", { method, path });
    console.log("[HANDLER] Event:", JSON.stringify(event));

    try {
        if (method === "POST" && path === "/import") {
            console.log("[ROUTE] /import triggered");
            return await handleImport(event);
        }

        if (method === "GET" && path === "/products") {
            console.log("[ROUTE] /products triggered");
            return await handleGetProducts();
        }

        if (method === "GET" && path.startsWith("/products/")) {
            const sku = path.split("/")[2];
            console.log("[ROUTE] /products/{sku}:", sku);
            return await handleGetProductBySku(sku);
        }

        if (method === "GET" && path.startsWith("/jobs/")) {
            const sku = path.split("/")[2];
            console.log("[ROUTE] /jobs/{sku}:", sku);
            return await handleGetJob(sku);
        }

        if (method === "POST" && path.startsWith("/retry/")) {
            const sku = path.split("/")[2];
            console.log("[ROUTE] /retry/{sku}:", sku);
            return await handleRetry(sku);
        }

        console.log("[ROUTE] No route matched");
        return {
            statusCode: 404,
            body: JSON.stringify({ message: "Route not found" })
        };

    } catch (err) {
        console.error("[HANDLER] Fatal error:", err);

        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Server error",
                error: err.message
            })
        };
    }
};

/* =========================================================
   1. IMPORT
========================================================= */
async function handleImport(event) {
    console.log("[IMPORT] Start");

    try {
        const body = JSON.parse(event.body || "{}");
        console.log("[IMPORT] Body parsed:", body);

        const rawCsv = body.csv;

        if (!rawCsv || typeof rawCsv !== "string") {
            console.log("[IMPORT] Invalid CSV");
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "CSV missing or invalid" })
            };
        }

        const csvData = rawCsv.replace(/\\n/g, "\n");
        console.log("[IMPORT] CSV normalized");

        const records = parse(csvData, {
            columns: true,
            skip_empty_lines: true
        });

        console.log("[IMPORT] Parsed records:", records.length);

        const db = await getDb();
        const collection = db.collection("products");

        const results = {
            inserted: 0,
            updated: 0,
            unchanged: 0,
            queued: 0
        };

        for (const item of records) {
            console.log("[IMPORT] Processing item:", item);

            if (!item.sku) {
                console.log("[IMPORT] Skipping item without SKU");
                continue;
            }

            const existing = await collection.findOne({ sku: item.sku });

            console.log("[IMPORT] Existing product:", existing);

            const isNew = !existing;

            const imageChanged =
                isNew ||
                normalizeUrl(existing.imageUrl) !== normalizeUrl(item.imageUrl);

            const hasChanges =
                isNew ||
                existing.title !== item.title ||
                existing.category !== item.category ||
                imageChanged;

            console.log("[IMPORT] isNew:", isNew, "hasChanges:", hasChanges);

            if (!hasChanges) {
                results.unchanged++;
                continue;
            }

            if (isNew) {
                console.log("[IMPORT] Inserting new product:", item.sku);

                await collection.insertOne({
                    sku: item.sku,
                    title: item.title,
                    category: item.category,
                    imageUrl: normalizeUrl(item.imageUrl),
                    status: "queued"
                });

                results.inserted++;
            } else {
                const updateFields = {};

                if (existing.title !== item.title) {
                    updateFields.title = item.title;
                }

                if (existing.category !== item.category) {
                    updateFields.category = item.category;
                }

                if (imageChanged) {
                    updateFields.imageUrl = normalizeUrl(item.imageUrl);
                    updateFields.status = "queued";
                }

                console.log("[IMPORT] Update fields:", updateFields);

                await collection.updateOne(
                    { sku: item.sku },
                    { $set: updateFields }
                );

                results.updated++;
            }

            if (imageChanged) {
                const messageBody = {
                    sku: item.sku,
                    imageUrl: normalizeUrl(item.imageUrl)
                };

                console.log("[IMPORT] Sending SQS message:", messageBody);

                await sqs.sendMessage({
                    QueueUrl: QUEUE_URL,
                    MessageBody: JSON.stringify(messageBody)
                }).promise();

                results.queued++;
            }
        }

        console.log("[IMPORT] Finished:", results);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Import completed",
                results
            })
        };

    } catch (err) {
        console.error("[IMPORT] Failed:", err);

        return {
            statusCode: 500,
            body: JSON.stringify({
                message: "Import failed",
                error: err.message
            })
        };
    }
}

/* =========================================================
   GET /products
========================================================= */
async function handleGetProducts() {
    console.log("[GET /products] start");

    const db = await getDb();
    const products = await db.collection("products").find({}).toArray();

    console.log("[GET /products] count:", products.length);

    return {
        statusCode: 200,
        body: JSON.stringify(products)
    };
}

/* =========================================================
   GET /products/{sku}
========================================================= */
async function handleGetProductBySku(sku) {
    console.log("[GET /products/{sku}] sku:", sku);

    const db = await getDb();
    const product = await db.collection("products").findOne({ sku });

    console.log("[GET /products/{sku}] result:", product);

    return {
        statusCode: 200,
        body: JSON.stringify(product)
    };
}

/* =========================================================
   GET /jobs/{sku}
========================================================= */
async function handleGetJob(sku) {
    console.log("[GET /jobs/{sku}] sku:", sku);

    const db = await getDb();
    const job = await db.collection("jobs").findOne({ sku });

    console.log("[GET /jobs/{sku}] result:", job);

    return {
        statusCode: 200,
        body: JSON.stringify(job)
    };
}

/* =========================================================
   POST /retry/{sku}
========================================================= */
async function handleRetry(sku) {
    console.log("[RETRY] sku:", sku);

    const db = await getDb();

    const product = await db.collection("products").findOne({ sku });

    console.log("[RETRY] product found:", product);

    if (!product) {
        console.log("[RETRY] product not found");
        return {
            statusCode: 404,
            body: JSON.stringify({ message: "Product not found" })
        };
    }

    console.log("[RETRY] sending SQS message");

    await sqs.sendMessage({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify({
            sku: product.sku,
            imageUrl: product.imageUrl
        })
    }).promise();

    console.log("[RETRY] completed for sku:", sku);

    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Retry queued" })
    };
}