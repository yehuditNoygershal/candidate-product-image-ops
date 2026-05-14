import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import AWS from "aws-sdk";
import axios from "axios";
import { Jimp } from "jimp";

dotenv.config();

const s3 = new AWS.S3();

const {
    MONGO_URI,
    DB_NAME,
    S3_BUCKET
} = process.env;

let mongoClient;

async function getDb() {
    if (!mongoClient) {
        mongoClient = new MongoClient(MONGO_URI);
        await mongoClient.connect();
    }
    return mongoClient.db(DB_NAME);
}

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

function buildS3Key(type, sku, ext) {
    return `${type}/${sku}.${ext}`;
}

function createSignedUrl(key) {
    return s3.getSignedUrl("getObject", {
        Bucket: S3_BUCKET,
        Key: key,
        Expires: 60 * 60 * 24
    });
}

export const handler = async (event) => {

    console.log("🚀 Lambda triggered - start batch processing");

    const db = await getDb();
    const productsCollection = db.collection("products");
    const jobsCollection = db.collection("jobs");

    for (const record of event.Records) {

        const startedAt = Date.now();
        let sku = null;
        let isRetry = false;

        try {

            // =========================
            // 1. Parse SQS message
            // =========================
            const body = JSON.parse(record.body);
            sku = body.sku;

            console.log(`➡️ START processing SKU: ${sku}`);

            const normalizedUrl = normalizeUrl(body.imageUrl);
            console.log(`🔗 Normalized image URL for SKU ${sku}`);

            // =========================
            // 2. Check retry status
            // =========================
            const existingProductBySku = await productsCollection.findOne({ sku });
            isRetry = existingProductBySku?.status === "failed";

            console.log(`🔁 Retry check for SKU ${sku}: ${isRetry}`);

            // =========================
            // 3. Mark processing
            // =========================
            await productsCollection.updateOne(
                { sku },
                {
                    $set: {
                        status: "processing",
                        imageUrl: normalizedUrl,
                        updatedAt: new Date()
                    }
                }
            );

            console.log(`⚙️ Processing image transformation for SKU ${sku}`);

            // =========================
            // 4. Duplicate check
            // =========================
            const existingProduct = await productsCollection.findOne({
                imageUrl: normalizedUrl,
                status: "processed"
            });

            if (existingProduct) {

                console.log(`⚠️ DUPLICATE detected for SKU ${sku} - skipping processing`);

                await productsCollection.updateOne(
                    { sku },
                    {
                        $set: {
                            status: "processed",
                            updatedAt: new Date(),
                            metadata: existingProduct.metadata,
                            message: "Duplicate processing detected. This image was already processed previously. No new processing was performed.",
                            originalImageS3Key: existingProduct.originalImageS3Key,
                            originalSignedUrl: existingProduct.originalSignedUrl,
                            processingTimeMs: existingProduct.processingTimeMs,
                            thumbnailS3Key: existingProduct.thumbnailS3Key,
                            thumbnailSignedUrl: existingProduct.thumbnailSignedUrl                             
                        }
                    }
                );

                await jobsCollection.insertOne({
                    sku,
                    imageUrl: normalizedUrl,
                    status: "duplicate",
                    isRetry,
                    message: "Duplicate processing detected. This image was already processed previously. No new processing was performed.",
                    createdAt: new Date()
                });

                continue;
            }

            // =========================
            // 5. Download image
            // =========================
            console.log(`⬇️ Downloading image for SKU ${sku}`);

            const response = await axios.get(normalizedUrl, {
                responseType: "arraybuffer",
                timeout: 15000
            });

            const buffer = Buffer.from(response.data);
            const contentType = response.headers["content-type"];

            console.log(`📦 Download complete for SKU ${sku} | size: ${buffer.length}`);

            if (!contentType?.startsWith("image/")) {
                throw new Error("Invalid image type");
            }

            const MAX_SIZE = 5 * 1024 * 1024;
            if (buffer.length > MAX_SIZE) {
                throw new Error("Image too large");
            }

            // =========================
            // 6. Image processing (Jimp)
            // =========================
            const image = await Jimp.read(buffer);

            const width = image.bitmap.width;
            const height = image.bitmap.height;

            image.scaleToFit({ w: 300, h: 300 });
            const thumbnailBuffer = await image.getBuffer("image/jpeg");

            console.log(`🖼 Thumbnail created for SKU ${sku}`);

            // =========================
            // 7. Upload to S3
            // =========================
            const originalKey = buildS3Key("original", sku, "jpg");
            const thumbnailKey = buildS3Key("thumbnail", sku, "jpg");

            console.log(`☁️ Uploading files to S3 for SKU ${sku}`);

            await s3.upload({
                Bucket: S3_BUCKET,
                Key: originalKey,
                Body: buffer,
                ContentType: contentType
            }).promise();

            await s3.upload({
                Bucket: S3_BUCKET,
                Key: thumbnailKey,
                Body: thumbnailBuffer,
                ContentType: "image/jpeg"
            }).promise();

            // =========================
            // 8. Final DB update
            // =========================
            const originalSignedUrl = createSignedUrl(originalKey);
            const thumbnailSignedUrl = createSignedUrl(thumbnailKey);

            await productsCollection.updateOne(
                { sku },
                {
                    $set: {
                        status: "processed",
                        originalImageS3Key: originalKey,
                        thumbnailS3Key: thumbnailKey,
                        originalSignedUrl,
                        thumbnailSignedUrl,
                        metadata: { width, height, format: "jpeg" },
                        processingTimeMs: Date.now() - startedAt,
                        updatedAt: new Date()
                    }
                }
            );

            await jobsCollection.insertOne({
                sku,
                imageUrl: normalizedUrl,
                status: "processed",
                isRetry,
                createdAt: new Date()
            });

            console.log(`✅ DONE SKU: ${sku}`);

        } catch (err) {

            console.log(`❌ FAILED SKU: ${sku}`);
            console.log(`💥 Error message: ${err.message}`);

            if (sku) {

                await productsCollection.updateOne(
                    { sku },
                    {
                        $set: {
                            status: "failed",
                            updatedAt: new Date()
                        }
                    }
                );

                await jobsCollection.insertOne({
                    sku,
                    status: "failed",
                    isRetry,
                    error: err.message,
                    createdAt: new Date()
                });

                console.log(`🧾 Failure logged for SKU: ${sku}`);
            }
        }
    }

    console.log("🏁 Batch processing completed");

    return { statusCode: 200 };
};