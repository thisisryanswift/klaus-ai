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
    if (!langflowApiKey) {
        return res.status(500).json({ error: 'Langflow API key not configured.' });
    }

    const langflowBaseUrl = process.env.LANGFLOW_BASE_URL;
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
        
        // Extract langflowId from the baseUrl
        const langflowId = process.env.LANGFLOW_ID;
        
        // Initialize the LangflowClient
        const client = new LangflowClient({
            langflowId,
            apiKey: langflowApiKey
        });
        
        // Step 1: Upload file to Langflow using the client library
        const uploadResult = await client.flow(flowId).uploadFile(tempFilePath);
        
        // Extract the file path from the upload result
        const langflowFilePath = uploadResult.filePath;
        
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
        const runResult = await client.flow(flowId).run(inputValue, options);
        
        // Return the result to the client
        res.json(runResult);

    } catch (error) {
        console.error('Error processing file upload:', error);
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