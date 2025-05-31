const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const fs = require('fs').promises;
const os = require('os');
const { LangflowClient } = require('@datastax/langflow-client');
const { GoogleGenAI, Type, createPartFromUri } = require("@google/genai");

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

// Gemini API interaction endpoint
app.post('/api/gemini-interaction', upload.fields([
  { name: 'imageFile', maxCount: 1 },
  { name: 'responseFormat', maxCount: 1 },
  { name: 'systemPrompt', maxCount: 1 },
  { name: 'userTTSInput', maxCount: 1 }
]), async (req, res) => {
  // Check if required fields are present
  if (!req.files || !req.files.imageFile || !req.files.imageFile[0]) {
    return res.status(400).json({ error: 'No image file uploaded.' });
  }

  if (!req.body.responseFormat) {
    return res.status(400).json({ error: 'Response format is required.' });
  }

  if (!req.body.systemPrompt) {
    return res.status(400).json({ error: 'System prompt is required.' });
  }

  if (!req.body.userTTSInput) {
    return res.status(400).json({ error: 'User input is required.' });
  }

  try {
    // Initialize the Google GenAI client
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY, vertexai: false }); // Use 'ai' and initialize as per example style

    // --- New File Upload Logic based on example ---
    const imageFile = req.files.imageFile[0];
    // Assuming Blob is available globally in your Node.js environment (Node.js >= v18.0.0 or v15.7.0+ with require('buffer').Blob)
    // If not, you might need: const { Blob } = require('buffer');
    const imageFileBlob = new Blob([imageFile.buffer], { type: imageFile.mimetype });

    console.log(`Uploading file to Gemini: ${imageFile.originalname}, type: ${imageFile.mimetype}`);
    // Upload the file.
    const uploadedFile = await ai.files.upload({
      file: imageFileBlob,
      config: { // This 'config' is for ai.files.upload
        displayName: imageFile.originalname,
      },
    });
    console.log(`Gemini file uploaded, name: ${uploadedFile.name}, uri: ${uploadedFile.uri}`);

    // Wait for the file to be processed.
    let getFile = await ai.files.get({ name: uploadedFile.name });
    console.log(`Initial Gemini file status: ${getFile.state}`);
    while (getFile.state === 'PROCESSING') {
      console.log('Gemini file is still processing, retrying in 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000)); // Non-blocking delay
      getFile = await ai.files.get({ name: uploadedFile.name });
      console.log(`Current Gemini file status: ${getFile.state}`);
    }

    if (getFile.state === 'FAILED') {
      console.error('Gemini file processing failed:', getFile);
      return res.status(500).json({ error: 'Gemini file processing failed.', details: getFile });
    }
    if (getFile.state !== 'ACTIVE') { // Ensure file is active for use
        console.error(`Gemini file processing finished with unexpected state: ${getFile.state}`, getFile);
        return res.status(500).json({ error: `Gemini file processing finished with unexpected state: ${getFile.state}`, details: getFile });
    }
    console.log(`Gemini file processing successful: ${getFile.name}, state: ${getFile.state}, uri: ${getFile.uri}`);
    // --- End New File Upload Logic ---

    const promptText = "Evaluate the game state and the user's instructions, and return an updated JSON blob of what is going on in the game right now. Here is the user's instructions: " + req.body.userTTSInput + " and here is the required JSON schema for your output (do not deviate from this format or we will all die): " + req.body.responseFormat;
    
    const apiContents = [
      { text: promptText }
    ];

    if (getFile.uri && getFile.mimeType) {
      const filePart = createPartFromUri(getFile.uri, getFile.mimeType);
      apiContents.push(filePart);
    } else {
      console.error('Gemini file URI or mimeType not available after processing. Cannot add to Gemini content.');
      return res.status(500).json({ error: 'File URI or mimeType not available after Gemini processing.' });
    }

    console.log('Preparing to call Gemini for content generation...');
    console.log('API Contents:', JSON.stringify(apiContents, null, 2));

    console.log('System Instruction:', JSON.stringify({ parts: [{ text: req.body.systemPrompt }] }, null, 2));
    
    console.log('Calling Gemini generateContent...');
    const geminijson = {
      model: "gemini-2.5-flash-preview-05-20", // "gemini-2.5-pro-preview-05-06",
      contents: apiContents,
      config: {responseMimeType: "application/json",
   systemInstruction: req.body.systemPrompt  }
    };
    console.log('Gemini JSON: ', JSON.stringify(geminijson));
    const geminiResponse = await ai.models.generateContent(geminijson);
    console.log('Gemini generateContent call successful.');
    
    // Send the response back to the client
    const rawText = geminiResponse.text; // Correctly call text() as a method
    console.log('Raw response from Gemini:', rawText);
    let jsonString = rawText;

    // Attempt to remove markdown JSON code block fences.
    // The 'm' flag allows ^ and $ to match start/end of lines across multiline strings,
    // and [\s\S] matches any character including newlines.
    const markdownMatch = rawText.match(/^```json\s*([\s\S]*?)\s*```$/m);
    if (markdownMatch && markdownMatch[1]) {
        jsonString = markdownMatch[1];
    }
    // If no markdown fence is found, jsonString remains rawText.
    // JSON.parse will then attempt to parse it directly.
    // This handles cases where Gemini might return plain JSON or an error string.

    try {
        const parsedJsonResponse = JSON.parse(jsonString);
        res.json({ response: parsedJsonResponse }); // Send the parsed JSON object
    } catch (parseError) {
        console.error('Failed to parse cleaned Gemini response as JSON. Error:', parseError.message);
        console.error('Original Gemini text:', rawText);
        console.error('Attempted to parse (after cleaning):', jsonString);
        // Send a more informative error response to the client
        res.status(500).json({
            error: 'Failed to parse Gemini API response as JSON.',
            details: {
                message: parseError.message,
                originalResponse: rawText,
                processedString: jsonString
            }
        });
    }
    
  } catch (error) {
    console.error('Error processing Gemini API request:', error.message);
    
    // Log the full error object for debugging
    console.error('Full error object:', error);
    
    res.status(500).json({
      error: 'Internal server error during Gemini API processing.',
      details: error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});