import { useState, useEffect } from "react";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { useAuth } from "../context/AuthContext";
import "../App.css";

const STORAGE_KEY = "stresscare-groups";

function generateJoinCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setGroups(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  const saveGroups = (newGroups) => {
    setGroups(newGroups);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newGroups));
  };

  const handleCreateGroup = () => {
    const trimmedName = newGroupName.trim();
    if (!trimmedName) {
      setError("Group name is required.");
      return;
    }
    const newGroup = {
      id: Date.now(),
      name: trimmedName,
      description: newGroupDesc.trim(),
      code: generateJoinCode(),
      ownerId: user?.uid || user?.email || "current-user",
      members: [
        {
          id: user?.uid || user?.email,
          name: user?.name || user?.email?.split('@')[0] || "You",
          email: user?.email,
        },
      ],
      tasks: [], // for future shared tasks
      createdAt: new Date().toISOString(),
    };
    saveGroups([...groups, newGroup]);
    setNewGroupName("");
    setNewGroupDesc("");
    setCreateModalOpen(false);
    setError("");
  };

  const handleJoinGroup = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError("Please enter a join code.");
      return;
    }
    const groupToJoin = groups.find(g => g.code === code);
    if (!groupToJoin) {
      setError("Group not found with that code.");
      return;
    }
    // Check if already a member
    const alreadyMember = groupToJoin.members.some(
      m => m.id === (user?.uid || user?.email)
    );
    if (alreadyMember) {
      setError("You are already a member of this group.");
      return;
    }
    const updatedGroups = groups.map(g => {
      if (g.id === groupToJoin.id) {
        return {
          ...g,
          members: [
            ...g.members,
            {
              id: user?.uid || user?.email,
              name: user?.name || user?.email?.split('@')[0] || "Student",
              email: user?.email,
            },
          ],
        };
      }
      return g;
    });
    saveGroups(updatedGroups);
    setJoinCode("");
    setJoinModalOpen(false);
    setError("");
  };

  const leaveGroup = (groupId) => {
    if (window.confirm("Leave this group? You will no longer see shared tasks.")) {
      const updatedGroups = groups.map(g => {
        if (g.id === groupId) {
          return {
            ...g,
            members: g.members.filter(m => m.id !== (user?.uid || user?.email)),
          };
        }
        return g;
      }).filter(g => g.members.length > 0); // remove empty groups
      saveGroups(updatedGroups);
    }
  };

  const deleteGroup = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (group?.ownerId !== (user?.uid || user?.email)) {
      alert("Only the group owner can delete the group.");
      return;
    }
    if (window.confirm("Delete this group permanently? This cannot be undone.")) {
      saveGroups(groups.filter(g => g.id !== groupId));
    }
  };

  const myGroups = groups.filter(g =>
    g.members.some(m => m.id === (user?.uid || user?.email))
  );

  return (
    <div className="app">
      <Header />
      <main className="dashboard">
        <section className="hero" id="groups-hero">
          <div className="hero-copy">
            <span className="eyebrow">Collaboration Hub</span>
            <h1>Study groups & shared tasks</h1>
            <p>
              Create a group, invite classmates with a join code, and share tasks to work together.
            </p>
          </div>
          <aside className="hero-panel">
            <h2>Groups</h2>
            <ul className="hero-list">
              <li>Create group → get join code</li>
              <li>Join existing group with code</li>
              <li>Share tasks to the group board</li>
              <li>Track group progress</li>
            </ul>
          </aside>
        </section>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginBottom: "2rem" }}>
          <button className="primary-button" onClick={() => setCreateModalOpen(true)}>
            + Create Group
          </button>
          <button className="secondary-button" onClick={() => setJoinModalOpen(true)}>
            🔗 Join Group
          </button>
        </div>

        {myGroups.length === 0 ? (
          <div className="panel" style={{ textAlign: "center" }}>
            <p className="schedule-empty">
              You are not in any group yet. Create a new group or join one with a code.
            </p>
          </div>
        ) : (
          <div className="groups-grid">
            {myGroups.map((group) => (
              <div key={group.id} className="group-card">
                <div className="group-header">
                  <h3>{group.name}</h3>
                  {group.ownerId === (user?.uid || user?.email) && (
                    <span className="owner-badge">Owner</span>
                  )}
                </div>
                {group.description && <p className="group-desc">{group.description}</p>}
                <div className="group-code">
                  Join code: <strong>{group.code}</strong>
                </div>
                <div className="group-members">
                  <span className="group-members-title">
                    Members ({group.members.length})
                  </span>
                  <ul className="members-list">
                    {group.members.map((member) => (
                      <li key={member.id}>
                        {member.name} {member.id === (user?.uid || user?.email) && "(you)"}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="group-actions">
                  <button
                    className="ghost-button"
                    onClick={() => alert("Coming soon: share tasks to this group")}
                  >
                    Share Task
                  </button>
                  {group.ownerId === (user?.uid || user?.email) ? (
                    <button className="remove-friend-btn" onClick={() => deleteGroup(group.id)}>
                      Delete Group
                    </button>
                  ) : (
                    <button className="remove-friend-btn" onClick={() => leaveGroup(group.id)}>
                      Leave Group
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Group Modal */}
      {createModalOpen && (
        <div className="modal-overlay" onClick={() => setCreateModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create a new study group</h2>
              <button className="modal-close" onClick={() => setCreateModalOpen(false)}>×</button>
            </div>
            <div className="form-grid">
              <div className="form-group full-span">
                <label>Group name *</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => {
                    setNewGroupName(e.target.value);
                    setError("");
                  }}
                  placeholder="e.g., CS50 Study Squad"
                  autoFocus
                />
              </div>
              <div className="form-group full-span">
                <label>Description (optional)</label>
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="What's this group for?"
                />
              </div>
              {error && <p className="form-error full-span">{error}</p>}
              <div className="modal-actions full-span">
                <button className="secondary-button" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button className="btn-create-task" style={{ width: "auto" }} onClick={handleCreateGroup}>
                  Create Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {joinModalOpen && (
        <div className="modal-overlay" onClick={() => setJoinModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Join a group</h2>
              <button className="modal-close" onClick={() => setJoinModalOpen(false)}>×</button>
            </div>
            <div className="form-grid">
              <div className="form-group full-span">
                <label>Enter the 6‑character join code</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(e.target.value.toUpperCase());
                    setError("");
                  }}
                  placeholder="e.g., A1B2C3"
                  autoFocus
                />
              </div>
              {error && <p className="form-error full-span">{error}</p>}
              <div className="modal-actions full-span">
                <button className="secondary-button" onClick={() => setJoinModalOpen(false)}>
                  Cancel
                </button>
                <button className="btn-create-task" style={{ width: "auto" }} onClick={handleJoinGroup}>
                  Join Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}