import { useState, useEffect } from "react";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { useAuth } from "./authentication/AuthContext";

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
      <main className="w-[min(1200px,calc(100%-20px))] md:w-[min(1200px,calc(100%-32px))] mx-auto pt-5 md:pt-8 pb-14 flex flex-col gap-6">
        <section className="border border-[var(--border-light)] rounded-lg bg-[var(--hero-bg)] shadow-[var(--card-shadow)] grid grid-cols-1 lg:grid-cols-[1.65fr_1fr] gap-6 p-[18px] md:p-8" id="groups-hero">
          <div>
            <span className="inline-flex gap-2 items-center uppercase tracking-[0.12em] text-[0.72rem] font-bold text-[#b91c1c]">Collaboration Hub</span>
            <h1 className="mt-[14px] mb-[16px] max-w-none lg:max-w-[15ch] text-[clamp(2rem,4vw,3.6rem)] leading-[1.04] font-bold text-[var(--text-primary)]">Study groups & shared tasks</h1>
            <p className="text-[var(--text-secondary)] leading-[1.6]">
              Create a group, invite classmates with a join code, and share tasks to work together.
            </p>
          </div>
          <aside className="bg-[var(--hero-panel-bg)] text-[var(--hero-panel-text)] p-6 rounded-lg flex flex-col gap-4">
            <h2 className="m-0 font-bold text-xl">Groups</h2>
            <ul className="list-disc pl-5 flex flex-col gap-2 text-[var(--hero-panel-text)]/90 leading-[1.6]">
              <li>Create group → get join code</li>
              <li>Join existing group with code</li>
              <li>Share tasks to the group board</li>
              <li>Track group progress</li>
            </ul>
          </aside>
        </section>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginBottom: "2rem" }}>
          <button className="border-none rounded-lg px-[18px] py-[14px] font-bold cursor-pointer transition-all duration-200 ease-in-out bg-gradient-to-br from-[#dc2626] to-[#fb7185] text-white shadow-[0_16px_30px_rgba(239,68,68,0.2)] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(220,38,38,0.15)] active:translate-y-[1px] active:scale-[0.98] active:shadow-[0_2px_5px_rgba(0,0,0,0.1)]" onClick={() => setCreateModalOpen(true)}>
            + Create Group
          </button>
          <button className="border border-[var(--btn-secondary-border)] rounded-lg px-[18px] py-[14px] font-bold cursor-pointer transition-all duration-200 ease-in-out bg-[var(--btn-secondary-bg)] text-[#dc2626] shadow-[inset_0_0_0_1px_rgba(220,38,38,0.08)] hover:bg-[rgba(220,38,38,0.08)] hover:text-[#b91c1c] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.05)] active:translate-y-[1px] active:scale-[0.98] active:shadow-[0_2px_5px_rgba(0,0,0,0.1)]" onClick={() => setJoinModalOpen(true)}>
            🔗 Join Group
          </button>
        </div>

        {myGroups.length === 0 ? (
          <div className="border border-[var(--border-light)] rounded-lg bg-[var(--panel-bg)] shadow-[var(--card-shadow)] p-[18px] md:p-6 text-center">
            <p className="p-3 rounded-lg bg-[var(--schedule-item-bg)] text-[var(--text-secondary)] leading-[1.6]">
              You are not in any group yet. Create a new group or join one with a code.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6 mt-4">
            {myGroups.map((group) => (
              <div key={group.id} className="bg-[var(--task-card-bg)] border border-[var(--border-light)] rounded-2xl p-5 shadow-[var(--card-shadow)] transition-all duration-200">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="m-0 text-xl text-[var(--text-primary)] font-bold">{group.name}</h3>
                  {group.ownerId === (user?.uid || user?.email) && (
                    <span className="bg-[#dc2626] text-white text-[0.7rem] font-semibold py-1 px-2.5 rounded-full">Owner</span>
                  )}
                </div>
                {group.description && <p className="text-[var(--text-secondary)] text-[0.85rem] my-2">{group.description}</p>}
                <div className="bg-[var(--input-bg)] py-1.5 px-3 rounded-lg text-[0.85rem] my-3 text-[var(--text-primary)]">
                  Join code: <strong className="font-mono text-base tracking-[1px]">{group.code}</strong>
                </div>
                <div>
                  <span className="font-semibold text-[0.85rem] text-[var(--text-secondary)] block mb-2">
                    Members ({group.members.length})
                  </span>
                  <ul className="list-none p-0 m-0 flex flex-wrap gap-2">
                    {group.members.map((member) => (
                      <li key={member.id} className="bg-[var(--schedule-item-bg)] py-1 px-2.5 rounded-full text-[0.8rem] text-[var(--text-primary)]">
                        {member.name} {member.id === (user?.uid || user?.email) && "(you)"}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    className="border-none rounded-lg font-bold cursor-pointer transition-all duration-200 ease-in-out bg-[var(--btn-ghost-bg)] text-[#b91c1c] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(220,38,38,0.15)] active:translate-y-[1px] active:scale-[0.98] active:shadow-[0_2px_5px_rgba(0,0,0,0.1)] py-1.5 px-4 text-[0.85rem]"
                    onClick={() => alert("Coming soon: share tasks to this group")}
                  >
                    Share Task
                  </button>
                  {group.ownerId === (user?.uid || user?.email) ? (
                    <button className="bg-transparent border-none cursor-pointer py-1.5 px-4 rounded-full text-[var(--text-secondary)] transition-all duration-200 hover:bg-[rgba(220,38,38,0.1)] hover:text-[#dc2626] text-[0.85rem] font-medium" onClick={() => deleteGroup(group.id)}>
                      Delete Group
                    </button>
                  ) : (
                    <button className="bg-transparent border-none cursor-pointer py-1.5 px-4 rounded-full text-[var(--text-secondary)] transition-all duration-200 hover:bg-[rgba(220,38,38,0.1)] hover:text-[#dc2626] text-[0.85rem] font-medium" onClick={() => leaveGroup(group.id)}>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4" onClick={() => setCreateModalOpen(false)}>
          <div className="bg-[var(--panel-bg)] rounded-2xl max-w-[550px] w-full max-h-[85vh] overflow-y-auto p-6 shadow-[0_24px_48px_rgba(0,0,0,0.2)] text-[var(--text-primary)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="m-0 text-[#b91c1c] text-xl font-bold">Create a new study group</h2>
              <button className="bg-transparent border-none text-[1.8rem] cursor-pointer leading-none text-[var(--text-secondary)] hover:text-[#b91c1c]" onClick={() => setCreateModalOpen(false)}>×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2 col-span-full">
                <label className="text-[0.9rem] font-semibold text-[var(--text-secondary)]">Group name *</label>
                <input
                  className="w-full px-[14px] py-[13px] rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] transition-all duration-200 focus:outline-none focus:border-[#ef4444] focus:shadow-[0_0_0_4px_rgba(239,68,68,0.12)] font-normal"
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
              <div className="flex flex-col gap-2 col-span-full">
                <label className="text-[0.9rem] font-semibold text-[var(--text-secondary)]">Description (optional)</label>
                <input
                  className="w-full px-[14px] py-[13px] rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] transition-all duration-200 focus:outline-none focus:border-[#ef4444] focus:shadow-[0_0_0_4px_rgba(239,68,68,0.12)] font-normal"
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="What's this group for?"
                />
              </div>
              {error && <p className="col-span-full mb-4 px-[14px] py-[12px] text-[#991b1b] bg-[#fef2f2] border border-[#fecaca] rounded-lg text-[0.92rem] font-bold">{error}</p>}
              <div className="col-span-full flex justify-end gap-3 mt-4">
                <button className="border border-[var(--btn-secondary-border)] rounded-lg px-[18px] py-[14px] font-bold cursor-pointer transition-all duration-200 ease-in-out bg-[var(--btn-secondary-bg)] text-[#dc2626] shadow-[inset_0_0_0_1px_rgba(220,38,38,0.08)] hover:bg-[rgba(220,38,38,0.08)] hover:text-[#b91c1c] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.05)] active:translate-y-[1px] active:scale-[0.98] active:shadow-[0_2px_5px_rgba(0,0,0,0.1)]" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </button>
                <button className="bg-gradient-to-br from-[#dc2626] to-[#fb7185] border-none py-[14px] px-[24px] rounded-[40px] font-bold text-base text-white inline-flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 shadow-[0_2px_6px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(220,38,38,0.3)] hover:from-[#b91c1c] hover:to-[#ef4444] active:translate-y-[1px] w-auto" onClick={handleCreateGroup}>
                  Create Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Join Group Modal */}
      {joinModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4" onClick={() => setJoinModalOpen(false)}>
          <div className="bg-[var(--panel-bg)] rounded-2xl max-w-[550px] w-full max-h-[85vh] overflow-y-auto p-6 shadow-[0_24px_48px_rgba(0,0,0,0.2)] text-[var(--text-primary)]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="m-0 text-[#b91c1c] text-xl font-bold">Join a group</h2>
              <button className="bg-transparent border-none text-[1.8rem] cursor-pointer leading-none text-[var(--text-secondary)] hover:text-[#b91c1c]" onClick={() => setJoinModalOpen(false)}>×</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2 col-span-full">
                <label className="text-[0.9rem] font-semibold text-[var(--text-secondary)]">Enter the 6‑character join code</label>
                <input
                  className="w-full px-[14px] py-[13px] rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] transition-all duration-200 focus:outline-none focus:border-[#ef4444] focus:shadow-[0_0_0_4px_rgba(239,68,68,0.12)] font-normal"
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
              {error && <p className="col-span-full mb-4 px-[14px] py-[12px] text-[#991b1b] bg-[#fef2f2] border border-[#fecaca] rounded-lg text-[0.92rem] font-bold">{error}</p>}
              <div className="col-span-full flex justify-end gap-3 mt-4">
                <button className="border border-[var(--btn-secondary-border)] rounded-lg px-[18px] py-[14px] font-bold cursor-pointer transition-all duration-200 ease-in-out bg-[var(--btn-secondary-bg)] text-[#dc2626] shadow-[inset_0_0_0_1px_rgba(220,38,38,0.08)] hover:bg-[rgba(220,38,38,0.08)] hover:text-[#b91c1c] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.05)] active:translate-y-[1px] active:scale-[0.98] active:shadow-[0_2px_5px_rgba(0,0,0,0.1)]" onClick={() => setJoinModalOpen(false)}>
                  Cancel
                </button>
                <button className="bg-gradient-to-br from-[#dc2626] to-[#fb7185] border-none py-[14px] px-[24px] rounded-[40px] font-bold text-base text-white inline-flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 shadow-[0_2px_6px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(220,38,38,0.3)] hover:from-[#b91c1c] hover:to-[#ef4444] active:translate-y-[1px] w-auto" onClick={handleJoinGroup}>
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