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

function imageToGenerateivePart(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64EncodedImage = imageBuffer.toString("base64");

  let mimeType = "image/jpeg";
  if (imagePath.toLowerCase().endsWith(".png")) {
    mimeType = "image/png";
  } else if (imagePath.toLowerCase().endsWith(".gif")) {
    mimeType = "image/gif";
  }
  return {
    inlineData: {
      data: base64EncodedImage,
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
  const image = imageToGenerateivePart(req.file.path);

  try {
    const result = await model.generateContent([prompt, image]);
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
    const filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);
    const base64Data = buffer.toString("base64");
    const mimeType = req.file.mimetype;
    const prompt = req.body.prompt || `Analyze this documents`;

    try {
      const documentPart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        },
      };
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


app.post('/generate-from-audio', upload.single('audio'), async (req, res) => { 
    const audioBuffer = fs.readFileSync(req.file.path)
    const base64Audio = audioBuffer.toString('base64')
    const prompt = req.body.prompt || `Transcribe or analyze the following audio`;
    const audioPart = {
        inlineData : { 
            data : base64Audio, 
            mimeType : req.file.mimetype
        }
    }

    try {
        const result = await model.generateContent([prompt, audioPart]);
        const response = await result.response;
        res.json({ output: response.text() });
      } catch (error) {
        res.status(500).json({ error: error.message });
      } finally {
        fs.unlinkSync(req.file.path);
      }
})


app.listen(PORT, () => {
  console.log(`Gemini API server is running at http://localhost:${PORT}`);
});

// temperature makin tinggi makin kreatif.. makin rendah makin nurut, ga macem2 sesuai apa yg disuruh)
