const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const multer = require("multer");
const fs = require("fs").promises;
const os = require("os");
const { LangflowClient } = require("@datastax/langflow-client");
const { GoogleGenAI, Type, createPartFromUri } = require("@google/genai");
const wav = require("wav");
const cors = require("cors");

// Load environment variables from .env file
dotenv.config();

// Initialize Express app
const app = express();

app.use(cors());

// Configure multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Define routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/heartbeat", (req, res) => {
  res.send(new Date().toISOString());
});

app.post("/api/uploadCached", upload.single("uploadedFile"), async (req, res) => {
    try {
        // Define paths to your files
        // __dirname is the directory of the current module (your .js file)
        const schemaFilePath = path.join(__dirname, 'jsonschema.json');
        const promptFilePath = path.join(__dirname, 'systemprompt.txt');

        // Read the content of the files
        // The 'utf8' encoding is important for reading text files correctly.
        const schemaContent = await fs.readFile(schemaFilePath, 'utf8');
        const promptContent = await fs.readFile(promptFilePath, 'utf8');

        // Construct the response object
        // The schemaContent will be a string. If your client expects a parsed JSON object
        // for the schema, you might need to do JSON.parse(schemaContent) here,
        // but typically for sending it in a response, a string is fine.
        const response = {
            schema: schemaContent,
            prompt: promptContent,
        };

        // Return the result to the client
        res.json(response);

    } catch (error) {
        console.error("Error reading schema or prompt file:", error);
        // Send an appropriate error response to the client
        if (error.code === 'ENOENT') { // ENOENT means "Error NO ENTry" (file not found)
            res.status(500).json({ error: "Configuration file not found. Please check server setup." });
        } else {
            res.status(500).json({ error: "Failed to load configuration for the request." });
        }
    }
});


// File upload and Langflow processing endpoint
app.post("/api/upload", upload.single("uploadedFile"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const langflowApiKey = process.env.LANGFLOW_KEY;
  const langflowLocalBaseUrl =
    process.env.LANGFLOW_LOCAL_BASE_URL || "http://localhost:7860";
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
        apiKey: langflowApiKey,
      });
      console.log(
        `LangflowClient initialized for CLOUD: baseUrl=${langflowLocalBaseUrl}, apiKey=****${langflowApiKey.slice(
          -4
        )}`
      );
    } else {
      // Local setup, no API key
      client = new LangflowClient({
        baseUrl: langflowLocalBaseUrl,
        // apiKey is intentionally omitted
      });
      console.log(
        `LangflowClient initialized for LOCAL: baseUrl=${langflowLocalBaseUrl}`
      );
    }

    // Step 1: Upload file to Langflow using the client library
    const flow = client.flow(flowId);
    console.log(`Flow instance created with flowId='${flowId}'`);

    console.log(
      `Attempting file upload: flowId='${flowId}', tempFilePath='${tempFilePath}'`
    );
    const uploadResult = await flow.uploadFile(tempFilePath);

    // Extract the file path from the upload result
    const langflowFilePath = uploadResult.filePath;
    console.log(
      `File upload successful, langflowFilePath: '${langflowFilePath}'`
    );

    if (!langflowFilePath) {
      console.error(
        "Langflow file upload response missing path:",
        uploadResult
      );
      return res.status(500).json({
        error: "Langflow file upload response did not include a file path.",
      });
    }

    // Step 2: Run the Langflow flow with the uploaded file path

    // Prepare the input and options for the flow run
    const inputValue = `File processed: ${req.file.originalname}`;
    const options = {
      input_type: "chat",
      output_type: "chat",
      tweaks: {
        [componentIdForFilePath]: {
          path: [langflowFilePath],
        },
      },
    };

    // Run the flow using the client library
    console.log(
      `Attempting flow run: flowId='${flowId}', inputValue='${inputValue}', options:`,
      JSON.stringify(options, null, 2)
    );
    const runResult = await flow.run(inputValue, options);

    console.log(
      `Flow run successful: flowId='${flowId}', runResult:`,
      JSON.stringify(runResult, null, 2)
    );

    const response = {
      schema: runResult.outputs[0].outputs[0].outputs.text.message,
      prompt: runResult.outputs[0].outputs[1].outputs.text.message,
    };

    // Return the result to the client
    res.json(response);
  } catch (error) {
    console.error("Error processing file upload:", error.message);

    // Enhanced error logging to extract more details from the API response
    if (error.cause && typeof error.cause.json === "function") {
      try {
        const errorDetails = await error.cause.json();
        console.error(
          "Langflow API Error Details (JSON):",
          JSON.stringify(errorDetails, null, 2)
        );
      } catch (jsonError) {
        console.error("Failed to parse error cause as JSON:", jsonError);
        if (typeof error.cause.text === "function") {
          try {
            const errorText = await error.cause.text();
            console.error("Langflow API Error Details (Text):", errorText);
          } catch (textError) {
            console.error("Failed to get error cause as text:", textError);
          }
        }
      }
    } else if (error.cause) {
      console.error("Langflow API Error Cause:", error.cause);
    }

    // Log the full error object for debugging
    console.error("Full error object:", error);

    res.status(500).json({
      error: "Internal server error during file processing.",
      details: error.message,
    });
  } finally {
    // Clean up the temporary file if it was created
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        console.error("Error cleaning up temporary file:", cleanupError);
      }
    }
  }
});

// Helper function to save WAV file
async function saveWaveFile(
  filename,
  pcmData,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
) {
  return new Promise((resolve, reject) => {
    const writer = new wav.FileWriter(filename, {
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    writer.on("finish", resolve);
    writer.on("error", reject);

    writer.write(pcmData);
    writer.end();
  });
}

// Gemini API interaction endpoint
app.post(
  "/api/gemini-interaction",
  upload.fields([
    { name: "imageFile", maxCount: 1 },
    { name: "responseFormat", maxCount: 1 },
    { name: "systemPrompt", maxCount: 1 },
    { name: "userTTSInput", maxCount: 1 },
  ]),
  async (req, res) => {
    // Check if required fields are present
    if (!req.files || !req.files.imageFile || !req.files.imageFile[0]) {
      return res.status(400).json({ error: "No image file uploaded." });
    }

    if (!req.body.responseFormat) {
      return res.status(400).json({ error: "Response format is required." });
    }

    if (!req.body.systemPrompt) {
      return res.status(400).json({ error: "System prompt is required." });
    }

    if (!req.body.userTTSInput) {
      return res.status(400).json({ error: "User input is required." });
    }

    try {
      // Initialize the Google GenAI client
      const ai = new GoogleGenAI({
        apiKey: process.env.GOOGLE_API_KEY,
        vertexai: false,
      }); // Use 'ai' and initialize as per example style

      // --- New File Upload Logic based on example ---
      const imageFile = req.files.imageFile[0];
      // Assuming Blob is available globally in your Node.js environment (Node.js >= v18.0.0 or v15.7.0+ with require('buffer').Blob)
      // If not, you might need: const { Blob } = require('buffer');
      const imageFileBlob = new Blob([imageFile.buffer], {
        type: imageFile.mimetype,
      });

      console.log(
        `Uploading file to Gemini: ${imageFile.originalname}, type: ${imageFile.mimetype}`
      );
      // Upload the file.
      const uploadedFile = await ai.files.upload({
        file: imageFileBlob,
        config: {
          // This 'config' is for ai.files.upload
          displayName: imageFile.originalname,
        },
      });
      console.log(
        `Gemini file uploaded, name: ${uploadedFile.name}, uri: ${uploadedFile.uri}`
      );

      // Wait for the file to be processed.
      let getFile = await ai.files.get({ name: uploadedFile.name });
      console.log(`Initial Gemini file status: ${getFile.state}`);
      while (getFile.state === "PROCESSING") {
        console.log(
          "Gemini file is still processing, retrying in 5 seconds..."
        );
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Non-blocking delay
        getFile = await ai.files.get({ name: uploadedFile.name });
        console.log(`Current Gemini file status: ${getFile.state}`);
      }

      if (getFile.state === "FAILED") {
        console.error("Gemini file processing failed:", getFile);
        return res
          .status(500)
          .json({ error: "Gemini file processing failed.", details: getFile });
      }
      if (getFile.state !== "ACTIVE") {
        // Ensure file is active for use
        console.error(
          `Gemini file processing finished with unexpected state: ${getFile.state}`,
          getFile
        );
        return res
          .status(500)
          .json({
            error: `Gemini file processing finished with unexpected state: ${getFile.state}`,
            details: getFile,
          });
      }
      console.log(
        `Gemini file processing successful: ${getFile.name}, state: ${getFile.state}, uri: ${getFile.uri}`
      );
      // --- End New File Upload Logic ---

      const promptText =
        "Evaluate the game state in our image, and return an updated JSON blob of what is going on in the game right now. Make sure you have a specific, and accurate parsing of the game state into our json format. Here is the required JSON schema for your output (do not deviate from this format or we will all die): " +
        req.body.responseFormat;

      const apiContents = [{ text: promptText }];

      if (getFile.uri && getFile.mimeType) {
        const filePart = createPartFromUri(getFile.uri, getFile.mimeType);
        apiContents.push(filePart);
      } else {
        console.error(
          "Gemini file URI or mimeType not available after processing. Cannot add to Gemini content."
        );
        return res
          .status(500)
          .json({
            error:
              "File URI or mimeType not available after Gemini processing.",
          });
      }

      console.log("Preparing to call Gemini for content generation...");
      // console.log('API Contents:', JSON.stringify(apiContents, null, 2));

      // console.log('System Instruction:', JSON.stringify({ parts: [{ text: req.body.systemPrompt }] }, null, 2));

      console.log("Calling Gemini generateContent...");
      const geminijson = {
        model: "gemini-2.5-flash-preview-05-20", // "gemini-2.5-pro-preview-05-06",
        contents: apiContents,
        config: {
          responseMimeType: "application/json",
          systemInstruction: "IMPORTANT NOTE: WE ARE PLAYING A MODIFIED VERSION OF THE GAME WITH ONLY 3 FLAGS, NOT THE NORMAL 9. ALL OTHER RULES ARE THE SAME." + req.body.systemPrompt,
          temperature: parseFloat(process.env.TEMPERATURE)
        },
      };
      //console.log('Gemini JSON: ', JSON.stringify(geminijson));
      const geminiResponse = await ai.models.generateContent(geminijson);
      console.log("Gemini generateContent call successful.");

      // Send the response back to the client
      const rawText = geminiResponse.text; // Correctly call text() as a method
      // console.log('Raw response from Gemini for game state:', rawText);
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
        // console.log('Successfully parsed first Gemini response:', parsedJsonResponse);

        // --- Step 2: Generate Text Summary ---
        console.log("Preparing to generate text summary...");
        // TODO: You might want to customize this prompt further
        const summaryPromptText = `Based on the following JSON representation of our game state: ${JSON.stringify(
          parsedJsonResponse,
          null,
          2
        )}, please provide a concise one sentence strategic recommendation based on the player's request (note that the player you are providing advice for is always Player 1 in the image): ${
          req.body.userTTSInput
        }`;
        console.log("Text summary prompt:", summaryPromptText);

        console.log("Calling Gemini to generate text summary...");
        const summaryResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-05-20", // Model for text generation
          contents: summaryPromptText,
          config: {
            systemInstruction: req.body.systemPrompt,
            temperature: parseFloat(process.env.TEMPERATURE)
          },
        });
        console.log("Gemini text summary generation successful.");

        const generatedSummaryText = "You are talking like Gordon Ramsey in Kitchen Nightmares. Say the following text in that style: " + summaryResponse.text;
        console.log("Generated text summary:", generatedSummaryText);

        if (!generatedSummaryText) {
          console.error("Gemini did not return text for the summary.");
          return res
            .status(500)
            .json({ error: "Failed to generate text summary from Gemini." });
        }

        // --- Step 3: Generate Audio from Text Summary (TTS) ---
        console.log("Preparing to generate audio (TTS) for the summary...");

        const ttsModel = "gemini-2.5-flash-preview-tts"; // TTS specific model from example
        const ttsContents = [{ parts: [{ text: generatedSummaryText }] }]; // Text to convert to speech
        const ttsGenerationConfig = {
            temperature: parseFloat(process.env.TEMPERATURE),
          responseModalities: ["AUDIO"], // Requesting only audio output
          speechConfig: {
            voiceConfig: {
              // Using 'Kore' voice from example, you can choose others
              prebuiltVoiceConfig: { voiceName: "Alnilam" },
            },
          },
        };
        // System instruction might not be strictly necessary for TTS, but can be included
        // const ttsSystemInstruction = { parts: [{ text: "Synthesize this text clearly." }] };

        console.log(
          `Calling Gemini TTS model ('${ttsModel}') to generate audio...`
        );
        const ttsResponse = await ai.models.generateContent({
          model: ttsModel,
          contents: ttsContents,
          config: ttsGenerationConfig,
          // systemInstruction: ttsSystemInstruction // Optional for TTS
        });
        console.log("Gemini TTS call successful.");

        const audioDataPart = ttsResponse.candidates?.[0]?.content?.parts?.[0];
        if (
          !audioDataPart ||
          !audioDataPart.inlineData ||
          !audioDataPart.inlineData.data
        ) {
          console.error(
            "Gemini TTS response did not contain audio data:",
            ttsResponse
          );
          return res
            .status(500)
            .json({
              error: "Failed to retrieve audio data from Gemini TTS response.",
            });
        }

        const base64AudioData = audioDataPart.inlineData.data;
        console.log("Successfully retrieved base64 audio data.");
        // const audioBuffer = Buffer.from(base64AudioData, 'base64'); // Original comment

        let audioUrl = null;
        if (base64AudioData) {
          try {
            const audioDir = path.join(__dirname, "public", "audio");
            // Ensure 'public/audio' directory exists. fs.mkdir with recursive:true is idempotent.
            await fs.mkdir(audioDir, { recursive: true });
            console.log(`Ensured directory exists or was created: ${audioDir}`);

            const audioFileName = `gemini_output_${Date.now()}.wav`;
            const audioFilePath = path.join(audioDir, audioFileName);
            const decodedAudioBuffer = Buffer.from(base64AudioData, "base64");

            // Use the new saveWaveFile function
            await saveWaveFile(audioFilePath, decodedAudioBuffer); // Using default 24kHz, 1 channel, 16-bit
            console.log(
              `Audio file saved successfully using wav.FileWriter: ${audioFilePath}`
            );
            audioUrl = `/audio/${audioFileName}`; // Relative URL for client access via express.static
          } catch (fileError) {
            console.error("Error saving audio file:", fileError.message);
            // audioUrl will remain null, and the client should handle cases where audioUrl is not provided.
          }
        }

        // Send text summary and the URL to the audio file (or null if saving failed)
        res.json({
          textResponse: summaryResponse.text,
          audioUrl: audioUrl,
        });
      } catch (parseError) {
        console.error(
          "Failed to parse cleaned Gemini response as JSON. Error:",
          parseError.message
        );
        console.error("Original Gemini text:", rawText); // rawText is from the first call, ensure context
        console.error("Attempted to parse (after cleaning):", jsonString);
        // Send a more informative error response to the client
        res.status(500).json({
          error: "Failed to parse Gemini API response as JSON.",
          details: {
            message: parseError.message,
            originalResponse: rawText,
            processedString: jsonString,
          },
        });
      }
    } catch (error) {
      console.error("Error processing Gemini API request:", error.message);

      // Log the full error object for debugging
      console.error("Full error object:", error);

      res.status(500).json({
        error: "Internal server error during Gemini API processing.",
        details: error.message,
      });
    }
  }
);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
