README 

Local Installation
Backend:
cd backend
npm install
npm run dev

Frontend:
cd frontend
npm install
npm run dev

Deployment

Frontend:
Hosted on AWS S3 static website hosting

URL:
http://candidate-product-image-frontend.s3-website.eu-central-1.amazonaws.com/

Backend:
AWS Lambda functions behind API Gateway
SQS used for async processing
MongoDB Atlas used for data storage

API URL:
https://0vq0us4gx9.execute-api.eu-central-1.amazonaws.com/prod

How to Test the System:

Import the CSV via the UI or API
Verify products appear in the admin table
Observe status flow:
queued → processing → processed → failed
Open failed items and retry processing
Confirm images are stored in S3 (original + processed)
If an image URL already exists for another product:
The system will show a message that the image was not reprocessed
Existing processed data will be reused
Processing metadata from the original run will still be available in the UI

Teardown Instructions: (AWS Resource Cleanup Order)

To fully clean up the system, delete AWS resources in the following order:

SQS Queue:
Ensure no messages are being processed before deletion
Lambda Functions:
Delete both API Lambda and image processing worker Lambda
API Gateway:
Remove the deployed REST API connected to the backend
S3 Buckets:
First empty the buckets completely
Then delete:
frontend hosting bucket
image storage bucket
CloudWatch Logs: (optional)
Delete log groups related to Lambda functions to avoid storage costs