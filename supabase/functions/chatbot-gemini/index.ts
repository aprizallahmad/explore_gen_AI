// Import dependensi yang diperlukan dari Deno dan URL eksternal
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai"; // Impor dari npm
import { corsHeaders } from "../_shared/cors.ts";

// --- DATA LOKAL ANDA (SAMA SEPERTI KODE ASLI) ---
// Data ini akan dibundel bersama function saat di-deploy
export const dataPesantren = {
  nama: "Pondok Pesantren Markazul Lughoh Al-Arobiyyah",
  pimpinan: "Ustadz Ahmad Alfarisi, S.Pd.I",
  lokasi: "Jl. Buncit Raya Pulo No. 17, Kalibata, Pancoran, Jakarta Selatan",
  // ... sisa data sama persis ...
  visi: "Mewujudkan generasi Rabbani yang menguasai Al-Qur’an & Bahasa Arab.",
  misi: [
      "Mencetak para penghafal Al-Qur’an.",
      "Mencetak para kader da’i yang mahir berbahasa arab.",
      "Mempersiapkan calon mahasiswa/i yang ingin melanjutkan studinya ke Timur Tengah.",
      "Membuka program Bahasa Arab & Al-Qur'an untuk umum."
  ],
};
export const dataKajian = [
    { tema: "Kajian Tafsir Al-Qur'an", pemateri: "Asatidz Markazul Lughoh" /* ... */ },
    { tema: "Mahya", pemateri: "Ustadz Ahmad Alfarisi, S.Pd.I" /* ... */ }
];
export const dataKegiatan = [
    { nama: "Bahasa Arab Intensif", deskripsi: "Program unggulan..." /* ... */ },
    { nama: "Kegiatan Ekstrakurikuler", deskripsi: "Mengembangkan potensi santri..." /* ... */ }
];
// --- AKHIR DATA LOKAL ---


// --- KONFIGURASI GEMINI AI (SAMA SEPERTI KODE ASLI) ---
// Ambil API key dari Supabase secrets
const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!);
const modelType = "models/gemini-1.5-flash";
const systemPrompt = `Anda adalah asisten virtual untuk ${dataPesantren.nama}. 
        Tugas Anda adalah menjawab pertanyaan pengunjung dengan ramah, sopan, dan informatif dalam Bahasa Indonesia. 
        Selalu kaitkan jawaban Anda dengan konteks pesantren ini. 
        Data Pesantren: ${JSON.stringify(dataPesantren)}, 
        Kajian: ${JSON.stringify(dataKajian)}, 
        Kegiatan: ${JSON.stringify(dataKegiatan)}. 
        Jika pengguna mengunggah gambar atau file, analisis gambar atau file tersebut. 
        Untuk semua permintaan lainnya, jawablah secara normal.
        Jika Dia ingin ngobrol, ajaklah dia ngobrol dengan santai.
        Jika promptnya mengandung kata "admin", beritahu bahwa itu hanya untuk admin dan tanya apakah anda seorang admin.
        Jika promptnya mengandung kata "khodimul markaz" maka dia adalah admin, dan sapa dia dengan sopan, 
        Jika promptnya mengandung kata "tes" maka dia adalah admin khodimul markaz, dan sapa dia dengan sopan`;

const model = genAI.getGenerativeModel({
  model: modelType,
  systemInstruction: systemPrompt
});

// --- FUNGSI UTAMA SERVER ---
// Fungsi `serve` ini adalah pengganti dari `app.listen()` di Express
serve(async (req) => {
  // Menangani preflight request untuk CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Mendapatkan path dari URL, misal: /generate-text
  const url = new URL(req.url);
  const route = url.pathname;

  try {
    // Routing sederhana pengganti app.post()
    switch (route) {
      case '/generate-text': {
        const { prompt } = await req.json();
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return new Response(JSON.stringify({ type: "text", text: response.text(), sender: "bot" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case '/generate-from-image':
      case '/generate-from-document':
      case '/generate-from-audio': {
        // --- INI PENGGANTI MULTER DAN FS ---
        // 1. Dapatkan data dari form multipart
        const formData = await req.formData();
        
        // 2. Ambil file dan prompt dari form data
        // Nama field ('image', 'document', 'audio') harus sesuai dengan yang dikirim client
        const file = formData.get('image') || formData.get('document') || formData.get('audio');
        const prompt = formData.get('prompt')?.toString() || 'Analyze this file';

        if (!file || !(file instanceof File)) {
             throw new Error("File tidak ditemukan atau format tidak valid.");
        }

        // 3. Baca file sebagai buffer di memori (pengganti fs.readFileSync)
        const buffer = await file.arrayBuffer();
        
        // 4. Konversi buffer ke base64
        const base64EncodedData = btoa(
            new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        
        // 5. Siapkan 'part' untuk Gemini API
        const filePart = {
            inlineData: {
                data: base64EncodedData,
                mimeType: file.type,
            },
        };

        // 6. Panggil Gemini API
        const result = await model.generateContent([prompt, filePart]);
        const response = await result.response;

        return new Response(JSON.stringify({ type: "file-analysis", text: response.text(), sender: "bot" }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      default:
        return new Response(JSON.stringify({ error: 'Route not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
