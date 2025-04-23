import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import io from "socket.io-client";
import "./Game.css";

const socket = io("http://192.168.1.44:4000");

function Game() {
  const query = new URLSearchParams(useLocation().search);
  const playerName = query.get("name") || "Player";

  const [players, setPlayers] = useState([]);
  const [topic, setTopic] = useState("Waiting for players...");
  const [currentTurn, setCurrentTurn] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptions, setTranscriptions] = useState([]);
  const [winner, setWinner] = useState(null);
  const [tieWinners, setTieWinners] = useState([]);

  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  useEffect(() => {
    socket.emit("joinGame", playerName);

    socket.on("updatePlayers", setPlayers);
    socket.on("startGame", ({ topic }) => {
      setTopic(topic);
      setWinner(null);
      setTieWinners([]);
    });

    socket.on("playerTurn", ({ currentPlayer }) => {
      setCurrentTurn(currentPlayer.id);
      if (currentPlayer.id === socket.id) startRecording();
    });

    socket.on("transcriptionUpdate", setTranscriptions);

    socket.on("gameEnded", ({ winner, tie, winners }) => {
      if (!tie && winner) {
        setWinner(winner);
      }
      if (tie && winners?.length > 0) {
        setTieWinners(winners);
      }
    });

    return () => socket.disconnect();
  }, [playerName]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => audioChunks.current.push(event.data);
      mediaRecorder.current.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });
        sendAudioToServer(audioBlob);
      };

      mediaRecorder.current.start();
      setIsRecording(true);

      setTimeout(() => stopRecording(), 9500); // stop just before timeout
    } catch (error) {
      console.error("Microphone error:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudioToServer = async (audioBlob) => {
    const formData = new FormData();
    formData.append("audioFile", audioBlob, "recording.wav");
    formData.append("playerId", socket.id);

    try {
      await fetch("http://192.168.1.44:4000/uploadAudio", {
        method: "POST",
        body: formData,
      });
    } catch (error) {
      console.error("Error uploading audio:", error);
    }
  };

  return (
    <div className="game-container">
      <div className="center">
        <h2>{topic}</h2>
      </div>

      {players.map((player, index) => (
        <div
          key={player.id}
          className={`player ${
            index === 0 ? "top" : index === 1 ? "left" : index === 2 ? "right" : "bottom"
          } ${player.id === currentTurn ? "active" : ""}`}
        >
          <h3>{player.name}</h3>
          <p>Score: {player.score}</p>
        </div>
      ))}
      
      <div className="transcribed">
        <h2>Transcriptions</h2>
        {transcriptions.map((entry, idx) => (
          <p key={idx}>
            <strong>{entry.name}:</strong> {entry.text} <br />
            <span className="score">Score: {entry.score.toFixed(2)}</span>
          </p>
        ))}
        {tieWinners.length > 0 && (
          <div className="winner">
            <h2>🤝 It's a tie!</h2>
            <p>
              {tieWinners.map((w) => w.name).join(", ")} each scored{" "}
              {tieWinners[0]?.score.toFixed(2)}
            </p>
          </div>
        )}
        {winner && (
          <div className="winner">
            <h2>🏆 Winner: {winner.name} with score {winner.score.toFixed(2)}!</h2>
          </div>
          
        )}
        
        
      </div>
      

        
    </div>
  );
}

export default Game;
