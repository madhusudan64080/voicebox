import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./Home.css";

function Home() {
  const fullText = "Welcome to VOICEBOX";
  const [displayedText, setDisplayedText] = useState("");
  const [index, setIndex] = useState(0);
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (index < fullText.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + fullText[index]);
        setIndex(index + 1);
      }, 100); // typing speed
      return () => clearTimeout(timeout);
    } else {
      // Show input after typing finishes
      setTimeout(() => setShowInput(true), 500);
    }
  }, [index]);

  return (
    <div className="home-container">
      <h1>{displayedText}</h1>

      {showInput && (
        <>
          <div className="name">
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="home-input"
            />
          </div>

          <Link
            to={name.trim() ? `/game?name=${encodeURIComponent(name)}` : "#"}
            className={`home-link ${!name.trim() ? "disabled" : ""}`}
            onClick={(e) => !name.trim() && e.preventDefault()}
          >
            Start Game
          </Link>
        </>
      )}
    </div>
  );
}

export default Home;
