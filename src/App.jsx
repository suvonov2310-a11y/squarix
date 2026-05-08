import React, { useState, useEffect, useRef } from 'react';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';
import { Buffer } from 'buffer';

const apiId = 3855698;
const apiHash = '1f631581137b45d42f1fa79fd58f2c53';

// YANGI: Har bir xabar va Rasm yuklash uchun alohida kichik komponent
const MessageItem = ({ msg, client, activeChat, theme, onMessageClick, getRepliedMsg }) => {
  const [mediaUrl, setMediaUrl] = useState('');

  // Agar xabar ichida rasm bo'lsa, uni avtomatik yuklab olib ekranga chizadi
  useEffect(() => {
    let isMounted = true;
    if (msg.media && msg.media.photo) {
      client.downloadMedia(msg).then(buffer => {
        if (buffer && isMounted) {
          const blob = new Blob([buffer], { type: 'image/jpeg' });
          setMediaUrl(URL.createObjectURL(blob));
        }
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [msg, client]);

  const msgTime = msg.date ? new Date(msg.date * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  let isRead = false;
  if (msg.out && activeChat?.dialog && msg.id <= activeChat.dialog.readOutboxMaxId) {
    isRead = true;
  }
  const repliedMsg = getRepliedMsg(msg.replyToMsgId);

  return (
    <div
      onClick={() => onMessageClick(msg)} // Bitta bosilganda menyu chiqishi uchun
      style={{
        maxWidth: '75%', minWidth: '70px', padding: '6px 12px 4px 12px', borderRadius: '12px',
        backgroundColor: msg.out ? theme.messageOut : theme.messageIn,
        color: theme.text,
        alignSelf: msg.out ? 'flex-end' : 'flex-start',
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column',
        cursor: 'pointer', userSelect: 'none'
      }}
    >
      {/* YANGI: Javob (Reply) qilingan xabarni ko'rsatish */}
      {msg.replyToMsgId && (
        <div style={{ borderLeft: `3px solid ${msg.out ? '#fff' : '#0088cc'}`, paddingLeft: '8px', marginBottom: '6px', fontSize: '13px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', padding: '4px 8px' }}>
          <span style={{fontWeight: 'bold', color: msg.out ? '#fff' : '#0088cc', display: 'block', fontSize: '11px'}}>Javob</span>
          <span style={{ opacity: 0.9, color: theme.text }}>{repliedMsg ? (repliedMsg.message || "📷 Media") : "..."}</span>
        </div>
      )}

      {/* YANGI: Rasm chat ichida ko'rinishi */}
      {mediaUrl && <img src={mediaUrl} alt="Media" style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', marginBottom: '5px', objectFit: 'contain' }} />}
      
      {/* Matn */}
      {msg.message && <span style={{ fontSize: '15px', wordBreak: 'break-word', marginBottom: '2px', color: theme.text }}>{msg.message}</span>}
      
      {/* Agar rasm bo'lmasa-yu, boshqa fayl bo'lsa */}
      {msg.media && !msg.media.photo && (
        <span style={{ fontSize: '14px', fontStyle: 'italic', color: theme.textMuted, marginBottom: '2px' }}>
          {msg.media.voice ? "🎤 Ovozli xabar" : "📁 Fayl / Video"}
        </span>
      )}

      {/* Vaqt va Pitichkalar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', fontSize: '11px', color: theme.textMuted, height: '14px' }}>
        <span>{msgTime}</span>
        {msg.out && <span style={{ color: isRead ? '#34b7f1' : theme.textMuted, fontSize: '13px', fontWeight: 'bold' }}>{isRead ? '✓✓' : '✓'}</span>}
      </div>
    </div>
  );
};

function App() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [client, setClient] = useState(null);
  const [step, setStep] = useState(1);
  
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  const [sendingMedia, setSendingMedia] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // YANGI: Menyu va Reply holatlari
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserFull, setCurrentUserFull] = useState(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState('');
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const messagesEndRef = useRef(null);
  const activeChatRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const theme = {
    bg: isDarkMode ? '#0f0f0f' : '#f0f2f5',
    chatBg: isDarkMode ? '#1e1e1e' : '#e5ddd5',
    panelBg: isDarkMode ? '#1a1a1a' : 'white',
    text: isDarkMode ? '#ffffff' : '#000000',
    textMuted: isDarkMode ? '#aaaaaa' : '#888888',
    border: isDarkMode ? '#333333' : '#dddddd',
    activeChat: isDarkMode ? '#2d2d2d' : '#e9ecef',
    messageOut: isDarkMode ? '#2b5278' : '#dcf8c6',
    messageIn: isDarkMode ? '#2d2d2d' : 'white',
    inputBg: isDarkMode ? '#333333' : 'white',
    inputPanel: isDarkMode ? '#1a1a1a' : '#f0f0f0'
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("squarix_theme");
    if (savedTheme === "dark") setIsDarkMode(true);
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem("squarix_theme", newTheme ? "dark" : "light");
  };

  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const savedSession = localStorage.getItem("squarix_session");
    if (savedSession) {
      setStep(3); 
      initClient().then(c => fetchInitialData(c));
    }
  }, []);

  useEffect(() => {
    if (!client) return;
    const handleNewMessage = (event) => {
      const message = event.message;
      const currentChat = activeChatRef.current;
      if (currentChat && message.chatId) {
        const msgId = String(message.chatId).replace('-100', '');
        const chatId = String(currentChat.id).replace('-100', '');
        if (msgId === chatId) {
          setMessages(prev => {
            if (prev.some(m => m.id === message.id)) return prev;
            return [...prev, message];
          });
        }
      }
    };
    client.addEventHandler(handleNewMessage, new NewMessage({ incoming: true, outgoing: true }));
    return () => client.removeEventHandler(handleNewMessage, new NewMessage({ incoming: true, outgoing: true }));
  }, [client]);

  const initClient = async () => {
    if (client) return client;
    const savedSession = localStorage.getItem("squarix_session") || "";
    const stringSession = new StringSession(savedSession);
    const telegramClient = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
    await telegramClient.connect();
    setClient(telegramClient);
    return telegramClient;
  };

  const fetchInitialData = async (tgClient) => {
    setLoadingChats(true);
    try {
      const me = await tgClient.getMe();
      setCurrentUser(me);
      const fullMe = await tgClient.invoke(new Api.users.GetFullUser({ id: me.id }));
      setCurrentUserFull(fullMe);
      if (me.photo) {
        const buffer = await tgClient.downloadProfilePhoto(me);
        if (buffer) setMyPhotoUrl(URL.createObjectURL(new Blob([buffer], { type: 'image/jpeg' })));
      }
      const dialogs = await tgClient.getDialogs({ limit: 150 }); 
      setChats(dialogs);
    } catch (error) { console.error(error); }
    setLoadingChats(false);
  };

  const sendCode = async () => {
    if (!phoneNumber) return;
    const tgClient = await initClient();
    try {
      const result = await tgClient.sendCode({ apiId, apiHash }, phoneNumber);
      setPhoneCodeHash(result.phoneCodeHash);
      setStep(2);
    } catch (error) { alert("Xatolik: " + error.message); }
  };

  const verifyCode = async () => {
    if (!phoneCode) return;
    try {
      const tgClient = await initClient();
      await tgClient.invoke(new Api.auth.SignIn({ phoneNumber, phoneCodeHash, phoneCode }));
      localStorage.setItem("squarix_session", tgClient.session.save());
      setStep(3);
      fetchInitialData(tgClient); 
    } catch (error) { alert("Xatolik: " + error.message); }
  };

  const openChat = async (chat) => {
    setActiveChat(chat);
    setMessages([]); 
    setNewMessage('');
    setIsRecording(false); 
    setReplyingTo(null); // Chat almashsa reply o'chadi
    try {
      let tgClient = await initClient();
      const msgs = await tgClient.getMessages(chat.entity, { limit: 100 });
      setMessages(msgs.reverse()); 
    } catch (error) { console.error(error); }
  };

  // YANGILANGAN: Xabarni Reply bilan jo'natish
  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChat) return;
    const textToSend = newMessage;
    setNewMessage('');
    try {
      let tgClient = await initClient();
      const sentMessage = await tgClient.sendMessage(activeChat.entity, { 
        message: textToSend,
        replyTo: replyingTo ? replyingTo.id : undefined
      });
      setReplyingTo(null); // Yuborilgach reply o'chadi
      setMessages(prev => {
        if (prev.some(m => m.id === sentMessage.id)) return prev;
        return [...prev, sentMessage];
      });
    } catch (error) { alert("Xabarni yuborib bo'lmadi!"); }
  };

  // YANGILANGAN: Xabarni Telegram menyusi kabi o'chirish
  const handleDeleteMessage = async (msgId) => {
    try {
      let tgClient = await initClient();
      await tgClient.deleteMessages(activeChat.entity, [msgId], { revoke: true });
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (error) {
      alert("Xabarni o'chirib bo'lmadi!");
    }
  };

  const handleMediaUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !activeChat) return;
    setSendingMedia(true);
    const textToSend = newMessage;
    setNewMessage('');
    try {
      let tgClient = await initClient();
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const cleanFile = new File([buffer], file.name, { type: file.type });
      const uploadedFile = await tgClient.uploadFile({ file: cleanFile, workers: 1 });
      const sentMessage = await tgClient.sendMessage(activeChat.entity, { 
        message: textToSend, 
        file: uploadedFile,
        replyTo: replyingTo ? replyingTo.id : undefined 
      });
      setReplyingTo(null);
      setMessages(prev => {
        if (prev.some(m => m.id === sentMessage.id)) return prev;
        return [...prev, sentMessage];
      });
    } catch (error) { alert("Media jo'natishda xatolik!"); }
    finally { setSendingMedia(false); event.target.value = null; }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        recorder.onstop = async () => {
          setSendingMedia(true);
          try {
            const mimeType = recorder.mimeType || 'audio/webm'; 
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
            const arrayBuffer = await audioBlob.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const file = new File([buffer], "voice.ogg", { type: mimeType });
            let tgClient = await initClient();
            const uploadedFile = await tgClient.uploadFile({ file: file, workers: 1 });
            const sentMessage = await tgClient.sendMessage(activeChat.entity, { 
              file: uploadedFile, 
              voiceNote: true,
              replyTo: replyingTo ? replyingTo.id : undefined
            });
            setReplyingTo(null);
            setMessages(prev => {
              if (prev.some(m => m.id === sentMessage.id)) return prev;
              return [...prev, sentMessage];
            });
          } catch (error) { alert("Ovozli xabar jo'natilmadi."); }
          finally { setSendingMedia(false); }
        };
        recorder.start();
        setIsRecording(true);
      } catch (err) { alert("Mikrofonga ruxsat bermadingiz!"); }
    }
  };

  const handleProfilePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      let tgClient = await initClient();
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const cleanFile = new File([buffer], file.name, { type: file.type });
      const uploadedFile = await tgClient.uploadFile({ file: cleanFile, workers: 1 });
      await tgClient.invoke(new Api.photos.UploadProfilePhoto({ file: uploadedFile }));
      alert("Profil rasmingiz yangilandi!");
      const me = await tgClient.getMe();
      const photoBuffer = await tgClient.downloadProfilePhoto(me);
      if (photoBuffer) setMyPhotoUrl(URL.createObjectURL(new Blob([photoBuffer], { type: 'image/jpeg' })));
    } catch (error) { alert("Rasm yuklashda xato!"); } 
    finally { setUploadingPhoto(false); }
  };

  const filteredChats = chats.filter(chat => {
    const isBot = chat.entity?.bot === true;
    const isUser = chat.isUser && !isBot;
    const isGroup = chat.isGroup;
    const isChannel = chat.isChannel && !chat.isGroup;
    if (activeTab === 'all') return true;
    if (activeTab === 'users') return isUser;
    if (activeTab === 'groups') return isGroup;
    if (activeTab === 'channels') return isChannel;
    if (activeTab === 'bots') return isBot;
    return true;
  });

  const TABS = [
    { id: 'all', label: 'Barchasi' }, { id: 'users', label: 'Shaxsiy' },
    { id: 'groups', label: 'Guruhlar' }, { id: 'channels', label: 'Kanallar' },
    { id: 'bots', label: 'Botlar' }
  ];

  const getRepliedMsg = (id) => {
    if (!id) return null;
    return messages.find(m => m.id === id);
  };

  if (step < 3) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
        <h1>Squarix Web 🚀</h1>
        {step === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="text" placeholder="+998..." value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} style={{ padding: '10px', fontSize: '16px', color: 'black' }} />
            <button onClick={sendCode} style={{ padding: '10px', cursor: 'pointer' }}>Kodni olish</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="text" placeholder="Kod..." value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} style={{ padding: '10px', fontSize: '16px', color: 'black' }} />
            <button onClick={verifyCode} style={{ padding: '10px', cursor: 'pointer', backgroundColor: '#28a745', color: '#fff' }}>Kirish</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'sans-serif', margin: '-8px', backgroundColor: theme.bg, overflow: 'hidden' }}>
      
      {/* Tepadagi "Modalka" (Xabar amallari uchun) */}
      {selectedMessage && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} 
          onClick={() => setSelectedMessage(null)}
        >
          <div 
            style={{ backgroundColor: theme.panelBg, padding: '20px', borderRadius: '15px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }} 
            onClick={e => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 5px 0', color: theme.text, textAlign: 'center' }}>Amalni tanlang</h4>
            
            <button onClick={() => { setReplyingTo(selectedMessage); setSelectedMessage(null); }} style={{ padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#0088cc', color: 'white', fontSize: '15px', cursor: 'pointer', fontWeight: 'bold' }}>
              ↪️ Javob berish (Reply)
            </button>

            {selectedMessage.out && (
              <button onClick={() => { handleDeleteMessage(selectedMessage.id); setSelectedMessage(null); }} style={{ padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#dc3545', color: 'white', fontSize: '15px', cursor: 'pointer', fontWeight: 'bold' }}>
                  🗑 Hammadan o'chirish
              </button>
            )}

            <button onClick={() => setSelectedMessage(null)} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: 'transparent', color: theme.text, fontSize: '15px', cursor: 'pointer', marginTop: '5px' }}>
              Bekor qilish
            </button>
          </div>
        </div>
      )}

      {/* CHAP TOMON RO'YXAT */}
      <div style={{ 
        display: (isMobile && activeChat) ? 'none' : 'flex', width: isMobile ? '100%' : '320px', 
        backgroundColor: theme.panelBg, borderRight: `1px solid ${theme.border}`, flexDirection: 'column' 
      }}>
        {showProfileSettings ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: theme.bg, overflowY: 'auto' }}>
            <div style={{ padding: '15px 20px', backgroundColor: '#0088cc', color: 'white', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <button onClick={() => setShowProfileSettings(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}>←</button>
              <h3 style={{ margin: 0 }}>Profil sozlamalari</h3>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: theme.panelBg, borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ position: 'relative', marginBottom: '15px' }}>
                {myPhotoUrl ? (
                  <img src={myPhotoUrl} alt="Profil" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #0088cc' }} />
                ) : (
                  <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: '#0088cc', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '40px', fontWeight: 'bold' }}>
                    {currentUser?.firstName?.charAt(0) || 'U'}
                  </div>
                )}
              </div>
              <h2 style={{ margin: '0 0 5px 0', fontSize: '20px', color: theme.text }}>{currentUser?.firstName} {currentUser?.lastName}</h2>
              <p style={{ margin: 0, color: theme.textMuted, fontSize: '15px' }}>+{currentUser?.phone}</p>
            </div>
            <div style={{ padding: '15px 20px', backgroundColor: theme.panelBg, marginTop: '10px', borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ marginBottom: '15px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#0088cc', fontWeight: 'bold' }}>Tarjimai hol (Bio)</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '15px', color: theme.text }}>{currentUserFull?.fullUser?.about || "Ma'lumot kiritilmagan"}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '13px', color: '#0088cc', fontWeight: 'bold' }}>Username</p>
                <p style={{ margin: '5px 0 0 0', fontSize: '15px', color: theme.text }}>{currentUser?.username ? `@${currentUser.username}` : "Username o'rnatilmagan"}</p>
              </div>
            </div>
            <div style={{ padding: '20px' }}>
              <input type="file" id="profilePic" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePhotoUpload} />
              <label htmlFor="profilePic" style={{ display: 'block', width: '100%', padding: '12px', backgroundColor: '#28a745', color: 'white', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', fontSize: '15px', fontWeight: 'bold' }}>
                {uploadingPhoto ? "Yuklanmoqda..." : "Rasmni o'zgartirish 📷"}
              </label>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '10px 15px', backgroundColor: '#0088cc', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {myPhotoUrl ? (
                  <img src={myPhotoUrl} alt="Me" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#005f8f', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>
                    {currentUser?.firstName?.charAt(0) || 'S'}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: 0, fontSize: '15px' }}>{currentUser?.firstName || '...'}</h3>
                  <span style={{ fontSize: '11px', color: '#b3e5fc' }}>Squarix Web</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '5px' }}>
                <button onClick={toggleTheme} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer', padding: '0 5px' }}>
                  {isDarkMode ? '☀️' : '🌙'}
                </button>
                <button onClick={() => setShowProfileSettings(true)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '22px', cursor: 'pointer', padding: '0 5px' }}>⋮</button>
              </div>
            </div>
            
            <div style={{ display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${theme.border}`, backgroundColor: theme.panelBg }}>
              {TABS.map(tab => (
                <button
                  key={tab.id} onClick={() => setActiveTab(tab.id)}
                  style={{ flex: '0 0 auto', padding: '12px 15px', border: 'none', backgroundColor: 'transparent', color: activeTab === tab.id ? '#0088cc' : theme.textMuted, borderBottom: activeTab === tab.id ? '3px solid #0088cc' : '3px solid transparent', cursor: 'pointer', fontSize: '14px', fontWeight: activeTab === tab.id ? 'bold' : 'normal', transition: 'all 0.2s' }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', backgroundColor: theme.panelBg }}>
              {loadingChats && <div style={{ padding: '20px', textAlign: 'center', color: theme.textMuted }}>Yuklanmoqda...</div>}
              {filteredChats.map((chat, idx) => (
                <div key={idx} onClick={() => openChat(chat)} style={{ padding: '12px 15px', borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', backgroundColor: activeChat?.id === chat.id ? theme.activeChat : 'transparent', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ width: '45px', height: '45px', minWidth: '45px', borderRadius: '50%', backgroundColor: chat.isGroup || chat.isChannel ? '#0088cc' : (chat.entity?.bot ? '#f39c12' : '#28a745'), color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '18px' }}>
                    {chat.title.charAt(0)}
                  </div>
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: '15px', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.title}</h4>
                    <p style={{ margin: '4px 0 0', fontSize: '14px', color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.message?.message || "Media xabar"}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* O'NG TOMON YOZISHMALAR */}
      <div style={{ 
        display: (isMobile && !activeChat) ? 'none' : 'flex', flex: 1, flexDirection: 'column', backgroundColor: theme.chatBg 
      }}>
        {activeChat ? (
          <>
            <div style={{ padding: '15px', backgroundColor: theme.panelBg, borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: '15px' }}>
              {isMobile && <button onClick={() => setActiveChat(null)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '0 10px 0 0', color: '#0088cc' }}>←</button>}
              <div style={{ width: '40px', height: '40px', minWidth: '40px', borderRadius: '50%', backgroundColor: '#0088cc', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>
                {activeChat.title.charAt(0)}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeChat.title}</h3>
                <span style={{ fontSize: '12px', color: theme.textMuted }}>{activeChat.entity?.bot ? "Bot" : activeChat.isGroup ? "Guruh" : activeChat.isChannel ? "Kanal" : "Shaxsiy"}</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* YANGI: Xabarlar pastga tushib turishi uchun bo'sh joy */}
              <div style={{ flex: 1 }} />
              
              {messages.length === 0 ? <div style={{ textAlign: 'center', marginTop: '20px', color: theme.textMuted }}>Yuklanmoqda...</div> : null}
              {messages.map((msg, idx) => (
                <MessageItem 
                  key={msg.id || idx} 
                  msg={msg} 
                  client={client} 
                  activeChat={activeChat} 
                  theme={theme} 
                  onMessageClick={(m) => setSelectedMessage(m)}
                  getRepliedMsg={getRepliedMsg}
                />
              ))}
              {sendingMedia && <div style={{ alignSelf: 'flex-end', padding: '8px 15px', backgroundColor: theme.activeChat, borderRadius: '10px', color: theme.text, fontSize: '13px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>Kuting, jo'natilmoqda... ⏳</div>}
              <div ref={messagesEndRef} />
            </div>

            {/* YANGI: Javob berilayotgan xabarni ko'rsatish oynasi */}
            {replyingTo && (
              <div style={{ padding: '8px 20px', backgroundColor: theme.activeChat, borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ borderLeft: '3px solid #0088cc', paddingLeft: '10px', overflow: 'hidden' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#0088cc', fontWeight: 'bold' }}>Javob berilyapti</p>
                  <p style={{ margin: '2px 0 0', fontSize: '14px', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyingTo.message || "📷 Media"}</p>
                </div>
                <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: theme.textMuted, fontSize: '20px', cursor: 'pointer' }}>✕</button>
              </div>
            )}

            <div style={{ padding: '12px 20px', backgroundColor: theme.inputPanel, display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="file" id="mediaUpload" style={{ display: 'none' }} onChange={handleMediaUpload} />
              <label htmlFor="mediaUpload" style={{ fontSize: '24px', cursor: 'pointer', color: theme.textMuted, padding: '0 5px' }}>📎</label>

              <input 
                type="text" 
                placeholder={isRecording ? "🔴 Ovoz yozilmoqda (Tugatish uchun ⏹ bosing)..." : "Xabar yozing..."} 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !isRecording) sendMessage(); }}
                disabled={isRecording}
                style={{ flex: 1, padding: '14px 20px', borderRadius: '25px', border: `1px solid ${theme.border}`, outline: 'none', fontSize: '15px', color: theme.text, backgroundColor: isRecording ? (isDarkMode ? '#5c2b2f' : '#ffebee') : theme.inputBg }} 
              />
              
              {newMessage.trim() && !isRecording ? (
                <button onClick={sendMessage} style={{ padding: '12px 20px', borderRadius: '25px', border: 'none', backgroundColor: '#0088cc', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Yuborish</button>
              ) : (
                <button 
                  onClick={toggleRecording} 
                  style={{ width: '45px', height: '45px', borderRadius: '50%', border: 'none', backgroundColor: isRecording ? '#dc3545' : '#0088cc', color: 'white', cursor: 'pointer', fontSize: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: '0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}
                >
                  {isRecording ? '⏹' : '🎤'}
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{ margin: 'auto', backgroundColor: isDarkMode ? '#333' : 'rgba(0,0,0,0.1)', padding: '12px 25px', borderRadius: '20px', color: theme.textMuted, fontSize: '15px', fontWeight: 'bold' }}>Chatni tanlang</div>
        )}
      </div>
    </div>
  );
}

export default App;