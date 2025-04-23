const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const { spawn } = require("child_process");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://192.168.1.44:5173", methods: ["GET", "POST"] },
});

const upload = multer({ dest: "uploads/" });
app.use(cors());

let players = [];
let transcriptions = [];
const topics = [
  "AI in daily life",
  "Future of space travel",
  "Climate change impact",
  "Importance of education",
];

let currentTurnIndex = 0;
let gameActive = false;
let selectedTopic = "";
let turnTimeout;

app.post("/uploadAudio", upload.single("audioFile"), (req, res) => {
  const audioPath = req.file.path;
  const playerId = req.body.playerId;

  console.log(`📥 Received audio from ${playerId}, saved at ${audioPath}`);

  const pythonProcess = spawn("C:\\Python313\\python.exe", ["transcribe.py", audioPath]);


  let outputData = "";
  let errorData = "";
  let responseSent = false;

  pythonProcess.stdout.on("data", (data) => {
    outputData += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    errorData += data.toString();
  });

  pythonProcess.on("close", (code) => {
    console.log(`🔍 Python process exited with code ${code}`);
    if (errorData) {
      console.error("❌ Python stderr:", errorData);
    }

    try {
      const parsed = JSON.parse(outputData);
      if (parsed.error) {
        console.error("❗ Transcription error:", parsed.error);
        return res.status(500).json({ error: parsed.error });
      }

      const { text: transcription, score } = parsed;
      console.log(`✅ Transcription received: "${transcription}" (Score: ${score})`);

      const player = players.find((p) => p.id === playerId);
      if (player) {
        player.transcription = transcription;
        player.score = score;
        

        transcriptions.push({ name: player.name, text: transcription, score });

        io.emit("transcriptionUpdate", transcriptions);

        console.log(`📊 Total transcriptions: ${transcriptions.length}/${players.length}`);

        if (transcriptions.length === players.length) {
          console.log("🎉 All players transcribed. Declaring winner...");
          declareWinner();
        }
      }

      fs.unlink(audioPath, () => {});
      if (!responseSent) {
        res.json({ success: true });
        responseSent = true;
      }
    } catch (err) {
      console.error("⚠️ Failed to parse Python output:", outputData);
      return res.status(500).json({ error: "Invalid transcription output" });
    }
  });

  pythonProcess.on("error", (err) => {
    console.error("🚨 Failed to start Python process:", err);
    if (!responseSent) {
      console.log("🔴 uploadAudio 500 error:", outputData || errorData);
      res.status(500).json({ error: "Failed to launch transcription process" });
      responseSent = true;
    }
  });
});


function declareWinner() {
  if (players.length < 1) return;

  const maxScore = Math.max(...players.map((p) => p.score));
  const winners = players.filter((p) => p.score === maxScore);

  if (winners.length === 1) {
    io.emit("gameEnded", { winner: winners[0], tie: false });
    console.log(`🏆 Winner: ${winners[0].name} with score ${winners[0].score}`);
  } else {
    const tieNames = winners.map((p) => p.name).join(", ");
    io.emit("gameEnded", { winner: null, tie: true, winners });
    console.log(`🤝 It's a tie between: ${tieNames} with score ${maxScore}`);
  }
}




io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinGame", (name) => {
    if (players.length >= 4) return;

    if (!players.find((p) => p.id === socket.id)) {
      players.push({ id: socket.id, name, score: 0 });
      io.emit("updatePlayers", players);
    }

    if (players.length === 4 && !gameActive) {
      gameActive = true;
      selectedTopic = topics[Math.floor(Math.random() * topics.length)];
      io.emit("startGame", { topic: selectedTopic });
      startNextTurn();
    }
  });
  

  function startNextTurn() {
    if (!gameActive || currentTurnIndex >= players.length) {
      gameActive = false;
      io.emit("gameEnded", {});
      return;
    }

    const currentPlayer = players[currentTurnIndex];

    io.emit("playerTurn", { currentPlayer });

    turnTimeout = setTimeout(() => {
      currentTurnIndex++;
      startNextTurn();
    }, 20000); // 20 seconds per turn
  }

  socket.on("disconnect", () => {
    players = players.filter((p) => p.id !== socket.id);
    io.emit("updatePlayers", players);

    if (players.length < 4) {
      gameActive = false;
      clearTimeout(turnTimeout);
      io.emit("gameCancelled", { message: "Game stopped due to insufficient players." });
    }
  });
});

server.listen(4000, "0.0.0.0", () => console.log("Server running on 0.0.0.0:4000"));
