import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai"; // <-- Ini yang benar
import cors from "cors"
import { dataKajian, dataKegiatan, dataPesantren } from "./datalokal.js";
import { fileURLToPath } from 'url'; // >>>>> Perubahan: Untuk __dirname dan __filename di ES Modules
const __filename = fileURLToPath(import.meta.url); // <<< Ini sudah ada
const __dirname = path.dirname(__filename); // <<< Ini sudah ada

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'))

// Inisialisasi GoogleGenerativeAI dengan API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const modelType = "models/gemini-1.5-flash"; // Sesuaikan dengan model yang Anda inginkan
const systemPrompt = `Anda adalah asisten virtual untuk ${dataPesantren.nama}. 
        Tugas Anda adalah menjawab pertanyaan pengunjung dengan ramah, sopan, dan informatif dalam Bahasa Indonesia. 
        Selalu kaitkan jawaban Anda dengan konteks pesantren ini. 
        Data Pesantren: ${JSON.stringify(dataPesantren)}, 
        Kajian: ${JSON.stringify(dataKajian)}, 
        Kegiatan: ${JSON.stringify(dataKegiatan)}. 
        Jika promptnya mengandung kata "admin", maka dia adalah admin khodimul markaz, dan sapa dia dengan sopan, 
        ingat, anda harus menjawab sesuai konteks pesantren yang sudah diberikan.`
  // Jika promptnya mengandung kata "test" maka dia adalah admin khodimul markaz, dan sapa dia dengan sopan
  // Jika pengguna mengunggah gambar atau file , analisis gambar atau file tersebut. 
  // Untuk semua permintaan lainnya, jawablah secara normal.
  // Jika Dia ingin ngobrol, ajaklah dia ngobrol dengan santai.
  // Jika promptnya mengandung kata "khodimul markaz" maka dia adalah admin, dan sapa dia dengan sopan
  ;

// Dapatkan instance model generatif
const model = genAI.getGenerativeModel({
  model: modelType,
  systemInstruction: systemPrompt
});

const uploadsDir = path.join(__dirname, 'uploads');
// Pastikan folder 'uploads' ada
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
const upload = multer({ dest: uploadsDir }); // Menggunakan path absolut untuk 'uploads'


// const upload = multer({ dest: "uploads/" }); // Masih diperlukan untuk generate-from-image

const PORT = 3000;

function generatePart(req) {
  console.log("generatePart filePath : ", req.file);
  // >>>>> Perubahan: Pastikan req.file ada sebelum membaca
  if (!req.file) {
    throw new Error("No file uploaded for generatePart.");
  }
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
  console.log("Hit generate-text:", prompt);
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text();
    res.json({ type: "text", text: generatedText, sender: "bot" });
  } catch (error) {
    console.error("Error generating text:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/generate-from-image", upload.single("image"), async (req, res) => {
  const prompt = req.body.prompt || "Describe the image";
  const imagePart = generatePart(req);
  console.log("Hit generate-from-image:", prompt);
  console.log("imagePart: ", imagePart);
  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    res.json({ type: "image", text: response.text(), sender: "bot" });
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
      res.json({ type: "document", text: response.text(), sender: "bot" });
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
  console.log("Hit generate-from-audio:", prompt);
  try {
    const result = await model.generateContent([prompt, audioPart]);
    const response = await result.response;
    res.json({ type: "text", text: response.text(), sender: "bot" });
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
