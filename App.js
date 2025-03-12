import React, { useState, useEffect, useRef } from "react";
import "./App.css";

// ----------------- FETCH FUNCTIONS ----------------- //

async function fetchCodeforcesSolved(username) {
  const url = `https://codeforces.com/api/user.status?handle=${username}&from=1&count=10000`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.status !== "OK") {
      console.error("Error from Codeforces API:", data);
      return [];
    }
    const solvedSet = {};
    data.result.forEach((sub) => {
      if (sub.verdict === "OK") {
        const problem = sub.problem || {};
        const contestId = problem.contestId;
        const index = problem.index;
        if (contestId && index) {
          const key = `${contestId}-${index}`;
          if (!solvedSet[key]) {
            solvedSet[key] = {
              platform: "Codeforces",
              name: problem.name,
              contestId,
              index,
              url: `https://codeforces.com/contest/${contestId}/problem/${index}`,
            };
          }
        }
      }
    });
    return Object.values(solvedSet);
  } catch (error) {
    console.error("Error parsing Codeforces response:", error);
    return [];
  }
}

async function fetchAtcoderSolved(username) {
  const url = `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${username}&from_second=0`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Error fetching AtCoder data: HTTP ${response.status}`);
      return [];
    }
    const submissions = await response.json();
    const solvedDict = {};
    submissions.forEach((sub) => {
      if (sub.result === "AC") {
        const problem_id = sub.problem_id;
        const contest_id = sub.contest_id;
        if (!solvedDict[problem_id]) {
          solvedDict[problem_id] = {
            platform: "AtCoder",
            problem_id,
            contest_id,
            url: `https://atcoder.jp/contests/${contest_id}/tasks/${problem_id}`,
          };
        }
      }
    });
    return Object.values(solvedDict);
  } catch (error) {
    console.error("Error parsing AtCoder response:", error);
    return [];
  }
}

// ----------------- Utility: Hyperlink Detection ----------------- //

function hyperlinkText(text) {
  const urlRegex = /(\bhttps?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a key={index} href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      );
    }
    return part;
  });
}

// ----------------- Main App Component ----------------- //

function App() {
  // Theme state for dark/light mode
  const [theme, setTheme] = useState("dark");
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // Tab state: "journal" or "solved"
  const [activeTab, setActiveTab] = useState("journal");

  // Journal states
  const [entry, setEntry] = useState("");
  const [entries, setEntries] = useState(() => {
    const saved = localStorage.getItem("journalEntries");
    return saved ? JSON.parse(saved) : [];
  });
  const [daySearchQuery, setDaySearchQuery] = useState("");
  const textAreaRef = useRef(null);

  // Editing state for journal entries
  const [editIndex, setEditIndex] = useState(null);
  const [editText, setEditText] = useState("");

  // Confirmation state for deletion modal
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState(null);

  // Solved Problems states
  const [solvedUsername, setSolvedUsername] = useState("");
  const [solvedProblems, setSolvedProblems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);

  // Expanded state for grouped day cards
  const [expandedDays, setExpandedDays] = useState({});

  useEffect(() => {
    localStorage.setItem("journalEntries", JSON.stringify(entries));
  }, [entries]);

  // ----------------- Rainbow ADHD Pointer Particle Effect ----------------- //
  useEffect(() => {
    const canvas = document.getElementById("animationCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    let hue = 0;
    let particles = [];
    let pointer = { x: width / 2, y: height / 2 };

    function spawnParticle(x, y) {
      return {
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        radius: Math.random() * 4 + 2,
        life: 100,
      };
    }

    function updateParticles() {
      ctx.clearRect(0, 0, width, height);
      hue = (hue + 1) % 360;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const dx = pointer.x - p.x;
        const dy = pointer.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          const ax = (dx / dist) * 0.1;
          const ay = (dy / dist) * 0.1;
          p.vx += ax;
          p.vy += ay;
        }
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (dist < 20) {
          p.radius *= 0.95;
        }
        const particleHue = (hue + i * 15) % 360;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${particleHue}, 100%, 50%)`;
        ctx.fill();
        if (p.life <= 0 || p.radius < 0.5) {
          particles.splice(i, 1);
        }
      }
    }

    function animate() {
      requestAnimationFrame(animate);
      updateParticles();
    }
    animate();

    function onMouseMove(e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      for (let i = 0; i < 4; i++) {
        particles.push(spawnParticle(pointer.x, pointer.y));
      }
    }
    document.addEventListener("mousemove", onMouseMove);

    function onResize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    }
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // ----------------- Journal Functions ----------------- //

  const saveJournalEntry = () => {
    if (entry.trim() === "") return;
    const now = new Date();
    const newEntry = {
      text: entry,
      date: now.toLocaleString(),
      day: now.toLocaleDateString(), // e.g., "3/12/2025"
      time: now.toLocaleTimeString(),
    };
    setEntries((prev) => [...prev, newEntry]);
    setEntry("");
  };

  const deleteEntry = (index) => {
    setEntries((prev) => prev.filter((_, idx) => idx !== index));
  };

  const clearAllEntries = () => {
    setEntries([]);
  };

  const editEntry = (index) => {
    setEditIndex(index);
    setEditText(entries[index].text);
  };

  const saveEditedEntry = (index) => {
    setEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], text: editText };
      return updated;
    });
    setEditIndex(null);
  };

  const cancelEdit = () => {
    setEditIndex(null);
  };

  const fetchSolvedProblemsAll = async () => {
    const cfProblems = await fetchCodeforcesSolved(solvedUsername);
    const acProblems = await fetchAtcoderSolved(solvedUsername);
    setSolvedProblems([...cfProblems, ...acProblems]);
    setVisibleCount(20);
  };

  // ----------------- Group Journal Entries by Day ----------------- //

  // Attach index to each entry for edit/delete functionality
  const entriesWithIndex = entries.map((item, idx) => ({ ...item, index: idx }));
  const groupedEntries = entriesWithIndex.reduce((groups, item) => {
    const day = item.day || new Date(item.date).toLocaleDateString();
    if (!groups[day]) groups[day] = [];
    groups[day].push(item);
    return groups;
  }, {});

  // Sort days in descending order (most recent first)
  let days = Object.keys(groupedEntries).sort((a, b) => new Date(b) - new Date(a));

  // Filter days using the search query
  if (daySearchQuery.trim() !== "") {
    days = days.filter((day) =>
      day.toLowerCase().includes(daySearchQuery.toLowerCase())
    );
  }

  // Toggle expansion for a given day
  const toggleDayExpand = (day) => {
    setExpandedDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  // ----------------- Render ----------------- //

  return (
    <div className={`app-container ${theme}-mode`}>
      {/* Theme Toggle Button */}
      <div className="theme-toggle">
        <AnimatedButton onClick={toggleTheme}>
          {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        </AnimatedButton>
      </div>

      {/* Canvas for pointer animation */}
      <canvas id="animationCanvas"></canvas>

      {/* Hero Section */}
      <div className="hero">
        <h1 className="hero-title">CP Diary</h1>
      </div>

      {/* Content Card */}
      <div className="problem-card">
        <div className="tab-buttons">
          <AnimatedButton
            onClick={() => setActiveTab("journal")}
            className={activeTab === "journal" ? "active" : ""}
          >
            Journal
          </AnimatedButton>
          <AnimatedButton
            onClick={() => setActiveTab("solved")}
            className={activeTab === "solved" ? "active" : ""}
          >
            Solved Problems
          </AnimatedButton>
        </div>

        {/* JOURNAL TAB */}
        {activeTab === "journal" && (
          <div>
            <textarea
              ref={textAreaRef}
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              placeholder="Write your journal entry here..."
              className="entry-textarea card"
            />
            <AnimatedButton onClick={saveJournalEntry} className="save-button card">
              Save Entry
            </AnimatedButton>
            <AnimatedButton onClick={clearAllEntries} className="delete-button card">
              Clear All Entries
            </AnimatedButton>

            {/* Search Bar for Days */}
            <input
              type="text"
              placeholder="Search by day (e.g., 3/12/2025)"
              value={daySearchQuery}
              onChange={(e) => setDaySearchQuery(e.target.value)}
              className="entry-input card"
            />

            {/* Day Cards */}
            {days.map((day) => (
              <div key={day} className="day-card" onClick={() => toggleDayExpand(day)}>
                <div className="day-card-header">
                  <h3 className="day-card-title">{day}</h3>
                </div>
                {expandedDays[day] && (
                  <div className="day-card-content">
                    <ul className="entries-list">
                      {groupedEntries[day].map((entryObj) => (
                        <li key={entryObj.index} className="entry-item">
                          <div className="entry-date">{entryObj.time}</div>
                          {editIndex === entryObj.index ? (
                            <div>
                              <textarea
                                value={editText}
                                onChange={(ev) => setEditText(ev.target.value)}
                                className="entry-textarea card"
                              />
                              <div className="edit-buttons">
                                <AnimatedButton
                                  onClick={() => saveEditedEntry(entryObj.index)}
                                  className="save-button small"
                                >
                                  Save
                                </AnimatedButton>
                                <AnimatedButton
                                  onClick={cancelEdit}
                                  className="cancel-button small"
                                >
                                  Cancel
                                </AnimatedButton>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="entry-text">
                                {hyperlinkText(entryObj.text)}
                              </div>
                              <div className="entry-actions">
                                <AnimatedButton
                                  onClick={() => editEntry(entryObj.index)}
                                  className="save-button small"
                                >
                                  Edit
                                </AnimatedButton>
                                <AnimatedButton
                                  onClick={() => setConfirmDeleteIndex(entryObj.index)}
                                  className="delete-button small"
                                >
                                  Delete
                                </AnimatedButton>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* SOLVED PROBLEMS TAB */}
        {activeTab === "solved" && (
          <div>
            <h2>Solved Problems</h2>
            <input
              type="text"
              placeholder="Enter username for solved problems..."
              value={solvedUsername}
              onChange={(e) => setSolvedUsername(e.target.value)}
              className="entry-input card"
            />
            <AnimatedButton onClick={fetchSolvedProblemsAll} className="fetch-button card">
              Fetch Solved Problems
            </AnimatedButton>
            <input
              type="text"
              placeholder="Search solved problems..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="entry-input card"
            />
            <ul className="problems-list">
              {solvedProblems
                .filter((prob) => {
                  const q = searchQuery.toLowerCase();
                  if (prob.platform === "Codeforces") {
                    return prob.name.toLowerCase().includes(q);
                  }
                  if (prob.platform === "AtCoder") {
                    const atName =
                      (prob.name && prob.name.toLowerCase()) ||
                      `${prob.contest_id ? prob.contest_id : ""} ${prob.problem_id ? prob.problem_id : ""}`.toLowerCase();
                    return atName.includes(q);
                  }
                  return false;
                })
                .slice(0, visibleCount)
                .map((p, idx) => (
                  <li key={idx} className="problem-item card">
                    {p.platform === "Codeforces" ? (
                      <div>
                        <strong>{p.platform}</strong> - {p.name}
                        <br />
                        <a href={p.url} target="_blank" rel="noopener noreferrer">
                          {p.url}
                        </a>
                      </div>
                    ) : p.platform === "AtCoder" ? (
                      <div>
                        <strong>{p.platform}</strong> - {p.contest_id} / {p.problem_id}
                        <br />
                        <a href={p.url} target="_blank" rel="noopener noreferrer">
                          {p.url}
                        </a>
                      </div>
                    ) : null}
                  </li>
                ))}
            </ul>
            {visibleCount < solvedProblems.length && (
              <AnimatedButton
                onClick={() => setVisibleCount(visibleCount + 20)}
                className="load-more-button card"
              >
                Load More
              </AnimatedButton>
            )}
          </div>
        )}
      </div>

      {/* Deletion Confirmation Modal */}
      {confirmDeleteIndex !== null && (
        <div className="modal-overlay">
          <div className="modal card">
            <p>Are you sure you want to delete this entry?</p>
            <div className="modal-buttons">
              <AnimatedButton
                onClick={() => {
                  deleteEntry(confirmDeleteIndex);
                  setConfirmDeleteIndex(null);
                }}
                className="save-button card"
              >
                Yes
              </AnimatedButton>
              <AnimatedButton
                onClick={() => setConfirmDeleteIndex(null)}
                className="cancel-button card"
              >
                No
              </AnimatedButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------- AnimatedButton Component ----------------- //

function AnimatedButton({ className, onClick, children }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      className={className}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position: "relative", overflow: "hidden" }}
    >
      <span className="button-content">{children}</span>
    </button>
  );
}

export default App;