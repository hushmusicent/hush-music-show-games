import React, { useState, useEffect } from 'react';
import { Friends, Auth, FriendItem, FriendRequest, store } from '../../services/backend';
import { Sound } from '../../services/sound';

interface Props {
  onToast: (msg: string) => void;
}

export const FriendsView: React.FC<Props> = ({ onToast }) => {
  const [friendsList, setFriendsList] = useState<FriendItem[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [addCode, setAddCode] = useState<string>('');
  const [activeChatFriend, setActiveChatFriend] = useState<FriendItem | null>(null);
  const [chatMessages, setChatMessages] = useState<{ who: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const list = await Friends.list();
    setFriendsList(list);
    const reqs = await Friends.requests();
    setRequests(reqs);
  };

  const handleSendRequest = async () => {
    if (!addCode.trim()) return;
    Sound.click();
    const code = addCode.trim().toUpperCase();

    const targetUser = await Friends.findByCode(code);
    if (!targetUser) {
      onToast('No player found with that 6-letter code.');
      return;
    }
    if (targetUser.uid === Auth.user?.uid) {
      onToast("That's your own code!");
      return;
    }

    await Friends.sendRequest(targetUser.uid);
    onToast(`Friend request sent to ${targetUser.username}!`);
    setAddCode('');
  };

  const handleAccept = async (uid: string) => {
    Sound.click();
    await Friends.accept(uid);
    onToast('Friend request accepted!');
    loadData();
  };

  const handleDecline = async (uid: string) => {
    Sound.click();
    await Friends.decline(uid);
    onToast('Friend request declined.');
    loadData();
  };

  const handleOpenChat = (friend: FriendItem) => {
    Sound.click();
    setActiveChatFriend(friend);
    // Load local chat history
    const myUid = Auth.user?.uid || 'u_local';
    const dmKey = 'dm_' + [myUid, friend.uid].sort().join('_');
    const history = store.get<{ who: string; text: string }[]>(dmKey, []);
    setChatMessages(history);
  };

  const handleSendDM = () => {
    if (!chatInput.trim() || !activeChatFriend) return;
    Sound.click();
    const myName = Auth.user?.username || 'You';
    const newMsg = { who: myName, text: chatInput.trim() };
    const updated = [...chatMessages, newMsg];
    setChatMessages(updated);
    setChatInput('');

    const myUid = Auth.user?.uid || 'u_local';
    const dmKey = 'dm_' + [myUid, activeChatFriend.uid].sort().join('_');
    store.set(dmKey, updated);
  };

  return (
    <div>
      <h2>👥 Friends</h2>

      <div className="card">
        {/* Add Friend Input */}
        <div className="row" style={{ marginBottom: 12 }}>
          <input
            className="grow"
            placeholder="Player code (6 letters)..."
            maxLength={6}
            value={addCode}
            onChange={(e) => setAddCode(e.target.value.toUpperCase())}
            style={{ textTransform: 'uppercase', margin: 0 }}
          />
          <button className="btn small" onClick={handleSendRequest}>
            Add Friend
          </button>
        </div>

        <div className="muted" style={{ marginBottom: 16 }}>
          Your code: <span className="codechip">{Auth.user?.code || '------'}</span> — share it so friends can add you!
        </div>

        {/* Requests */}
        {requests.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h3>Incoming Requests ({requests.length})</h3>
            {requests.map((r) => (
              <div key={r.uid} className="row" style={{ margin: '6px 0' }}>
                <div className="grow"><b>{r.from}</b></div>
                <button className="btn small" onClick={() => handleAccept(r.uid)}>Accept</button>
                <button className="btn small secondary" onClick={() => handleDecline(r.uid)}>Decline</button>
              </div>
            ))}
          </div>
        )}

        {/* Friends List */}
        <h3>Your Friends ({friendsList.length})</h3>
        {friendsList.length === 0 ? (
          <div className="muted" style={{ padding: '8px 0' }}>
            No friends added yet. Share your code to connect!
          </div>
        ) : (
          friendsList.map((f) => (
            <div key={f.uid} className="row" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="grow">
                <span>{f.online ? '🟢' : '⚪'} </span>
                <b>{f.username}</b> <span className="muted">({f.code})</span>
              </div>
              <button className="btn small secondary" onClick={() => handleOpenChat(f)}>
                Chat
              </button>
            </div>
          ))
        )}

        {/* DM Chat Modal / Section */}
        {activeChatFriend && (
          <div style={{ marginTop: 18, borderTop: '2px solid var(--gold)', paddingTop: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <h3>Chat with {activeChatFriend.username}</h3>
              <button className="btn small secondary" onClick={() => setActiveChatFriend(null)}>
                Close
              </button>
            </div>

            <div className="chatbox" style={{ maxHeight: 200 }}>
              {chatMessages.length === 0 ? (
                <div className="muted" style={{ fontSize: 12 }}>No messages in this conversation yet.</div>
              ) : (
                chatMessages.map((m, i) => (
                  <div key={i} className="msg" style={{ margin: '4px 0' }}>
                    <span className="who">{m.who}:</span> {m.text}
                  </div>
                ))
              )}
            </div>

            <div className="row">
              <input
                className="grow"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendDM()}
              />
              <button className="btn small" onClick={handleSendDM}>Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
