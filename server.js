const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const fs = require('fs').promises;
const os = require('os');
const { LangflowClient } = require('@datastax/langflow-client');

// Load environment variables from .env file
dotenv.config();

// Initialize Express app
const app = express();

// Configure multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Define routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// File upload and Langflow processing endpoint
app.post('/api/upload', upload.single('uploadedFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    const langflowApiKey = process.env.LANGFLOW_KEY;
    const langflowLocalBaseUrl = process.env.LANGFLOW_LOCAL_BASE_URL || 'http://localhost:7860';
    const flowId = process.env.FLOW_ID;
    const componentIdForFilePath = process.env.LANGFLOW_FILE_COMPONENT;

    let tempFilePath = null;
    
    try {
        // Create a unique temporary file name
        const timestamp = Date.now();
        const uniqueFilename = `${timestamp}-${req.file.originalname}`;
        tempFilePath = path.join(os.tmpdir(), uniqueFilename);
        
        // Write the buffer to a temporary file
        await fs.writeFile(tempFilePath, req.file.buffer);
        
        // Initialize the LangflowClient based on whether we have an API key
        let client;

        if (langflowApiKey) {
            // Hosted setup with API key
            client = new LangflowClient({
                baseUrl: langflowLocalBaseUrl,
                apiKey: langflowApiKey
            });
            console.log(`LangflowClient initialized for CLOUD: baseUrl=${langflowLocalBaseUrl}, apiKey=****${langflowApiKey.slice(-4)}`);
        } else {
            // Local setup, no API key
            client = new LangflowClient({
                baseUrl: langflowLocalBaseUrl
                // apiKey is intentionally omitted
            });
            console.log(`LangflowClient initialized for LOCAL: baseUrl=${langflowLocalBaseUrl}`);
        }
        
        // Step 1: Upload file to Langflow using the client library
        const flow = client.flow(flowId);
        console.log(`Flow instance created with flowId='${flowId}'`);

        console.log(`Attempting file upload: flowId='${flowId}', tempFilePath='${tempFilePath}'`);
        const uploadResult = await flow.uploadFile(tempFilePath);
        
        // Extract the file path from the upload result
        const langflowFilePath = uploadResult.filePath;
        console.log(`File upload successful, langflowFilePath: '${langflowFilePath}'`);
        
        if (!langflowFilePath) {
            console.error('Langflow file upload response missing path:', uploadResult);
            return res.status(500).json({ error: 'Langflow file upload response did not include a file path.' });
        }

        // Step 2: Run the Langflow flow with the uploaded file path
        
        // Prepare the input and options for the flow run
        const inputValue = `File processed: ${req.file.originalname}`;
        const options = {
            input_type: "chat",
            output_type: "chat",
            tweaks: {
                [componentIdForFilePath]: {
                    "path": [langflowFilePath]
                }
            }
        };
        
        // Run the flow using the client library
        console.log(`Attempting flow run: flowId='${flowId}', inputValue='${inputValue}', options:`, JSON.stringify(options, null, 2));
        const runResult = await flow.run(inputValue, options);
        
        // Return the result to the client
        res.json(runResult);

    } catch (error) {
        console.error('Error processing file upload:', error.message);
        
        // Enhanced error logging to extract more details from the API response
        if (error.cause && typeof error.cause.json === 'function') {
            try {
                const errorDetails = await error.cause.json();
                console.error('Langflow API Error Details (JSON):', JSON.stringify(errorDetails, null, 2));
            } catch (jsonError) {
                console.error('Failed to parse error cause as JSON:', jsonError);
                if (typeof error.cause.text === 'function') {
                    try {
                        const errorText = await error.cause.text();
                        console.error('Langflow API Error Details (Text):', errorText);
                    } catch (textError) {
                        console.error('Failed to get error cause as text:', textError);
                    }
                }
            }
        } else if (error.cause) {
            console.error('Langflow API Error Cause:', error.cause);
        }
        
        // Log the full error object for debugging
        console.error('Full error object:', error);
        
        res.status(500).json({ error: 'Internal server error during file processing.', details: error.message });
    } finally {
        // Clean up the temporary file if it was created
        if (tempFilePath) {
            try {
                await fs.unlink(tempFilePath);
            } catch (cleanupError) {
                console.error('Error cleaning up temporary file:', cleanupError);
            }
        }
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});