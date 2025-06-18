import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import fs, { read } from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai"; // <-- Ini yang benar

dotenv.config();
const app = express();
app.use(express.json());

// Inisialisasi GoogleGenerativeAI dengan API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelType = "models/gemini-2.5-flash"; // Sesuaikan dengan model yang Anda inginkan

// Dapatkan instance model generatif
const model = genAI.getGenerativeModel({
  model: modelType,
});

const upload = multer({ dest: "uploads/" }); // Masih diperlukan untuk generate-from-image

const PORT = 3000;

function generatePart(req) {
  const filePath = req.file.path;
  const dataBuffer = fs.readFileSync(filePath);
  const base64EncodedData = dataBuffer.toString("base64");
  const mimeType = req.file.mimetype;

  return {
    inlineData: {
      data: base64EncodedData,
      mimeType: mimeType,
    },
  };
}

app.post("/generate-text", async (req, res) => {
  const { prompt } = req.body;
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text();
    res.json({ output: generatedText });
  } catch (error) {
    console.error("Error generating text:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/generate-from-image", upload.single("image"), async (req, res) => {
  const prompt = req.body.prompt || "Describe the image";
  const imagePart = generatePart(req);
  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    res.json({ output: response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    fs.unlinkSync(req.file.path);
  }
});

app.post(
  "/generate-from-document",
  upload.single("document"),
  async (req, res) => {
    const prompt = req.body.prompt || `Analyze this documents`;
    const documentPart = generatePart(req);
    try {
      const result = await model.generateContent([prompt, documentPart]);
      const response = await result.response;
      res.json({ output: response.text() });
    } catch (error) {
      res.status(500).json({ error: error.message });
    } finally {
      fs.unlinkSync(req.file.path);
    }
  }
);

app.post("/generate-from-audio", upload.single("audio"), async (req, res) => {
  const prompt = req.body.prompt || `Transcribe or analyze the following audio`;
  const audioPart = generatePart(req);
  try {
    const result = await model.generateContent([prompt, audioPart]);
    const response = await result.response;
    res.json({ output: response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    fs.unlinkSync(req.file.path);
  }
});

app.listen(PORT, () => {
  console.log(`Gemini API server is running at http://localhost:${PORT}`);
});

// temperature makin tinggi makin kreatif.. makin rendah makin nurut, ga macem2 sesuai apa yg disuruh)
