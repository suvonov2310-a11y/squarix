import React, { useState, useEffect, useRef } from 'react';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage, Raw } from 'telegram/events';
import { Buffer } from 'buffer';

const apiId = 3855698;
const apiHash = '1f631581137b45d42f1fa79fd58f2c53';

let globalTgClient = null;

const EMOJIS = [
  '😀','😃','😄','😁','😆','😅','😂','🤣','🥲','☺️','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗',
  '😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕',
  '🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰',
  '😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','👍','👎','👏','🙌','👐','🤲','🤝','🙏'
];

const globalAvatarCache = new Map();

const getAvatarColor = (idStr) => {
  const colors = ['#e17076', '#faa774', '#a695e7', '#7bc862', '#6ec9cb', '#65aadd', '#ee7aae'];
  if (!idStr) return colors[0];
  const num = parseInt(idStr.slice(-1) || '0', 10);
  return colors[num % colors.length] || colors[0];
};

const LazyAvatar = ({ client, entity, size = 45, fallbackText, style }) => {
  const [imgUrl, setImgUrl] = useState(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (client && entity) {
      const idStr = entity.id ? entity.id.toString() : null;
      
      if (idStr && globalAvatarCache.has(idStr)) {
         setImgUrl(globalAvatarCache.get(idStr));
         return;
      }

      client.downloadProfilePhoto(entity).then(buffer => {
        if (buffer && buffer.length > 0 && isMounted) {
          const url = URL.createObjectURL(new Blob([buffer], { type: 'image/jpeg' }));
          if (idStr) globalAvatarCache.set(idStr, url);
          setImgUrl(url);
        } else if (isMounted) { setHasError(true); }
      }).catch(() => { if (isMounted) setHasError(true); });
    } else { setHasError(true); }
    return () => { isMounted = false; };
  }, [client, entity]);

  const circleSize = typeof size === 'number' ? `${size}px` : size;
  const fontSize = typeof size === 'number' ? `${size * 0.4}px` : '18px';

  if (imgUrl && !hasError) {
    return <img src={imgUrl} alt="" onError={() => setHasError(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', ...style }} />;
  }
  
  return (
    <div style={{ width: circleSize, height: circleSize, minWidth: circleSize, borderRadius: '50%', backgroundColor: getAvatarColor(entity?.id?.toString()), color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: fontSize, ...style }}>
      {fallbackText ? fallbackText.charAt(0).toUpperCase() : '?'}
    </div>
  );
};

const MessageItem = ({ msg, client, activeChat, theme, onMessageClick, getRepliedMsg, onSenderProfileClick }) => {
  const [mediaUrl, setMediaUrl] = useState('');
  
  useEffect(() => {
    let isMounted = true;
    if (msg.media && msg.media.photo) {
      client.downloadMedia(msg).then(buffer => {
        if (buffer && buffer.length > 0 && isMounted) setMediaUrl(URL.createObjectURL(new Blob([buffer], { type: 'image/jpeg' })));
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [msg, client]);

  const msgTime = msg.date ? new Date(msg.date * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  let isRead = false;
  if (msg.out && activeChat?.dialog && msg.id <= activeChat.dialog.readOutboxMaxId) isRead = true;
  const repliedMsg = getRepliedMsg(msg.replyToMsgId);

  const isGroupChat = activeChat?.isGroup || activeChat?.isChannel && activeChat?.entity?.megagroup;
  const showSenderInfo = isGroupChat && !msg.out && msg.sender;
  const senderName = msg.sender?.firstName || msg.sender?.title || "Foydalanuvchi";

  return (
    <div style={{ display: 'flex', gap: '8px', alignSelf: msg.out ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
      {showSenderInfo && (
        <div onClick={(e) => { e.stopPropagation(); onSenderProfileClick(msg.sender, senderName); }} style={{ alignSelf: 'flex-end', cursor: 'pointer', marginBottom: '4px' }}>
          <LazyAvatar client={client} entity={msg.sender} size={35} fallbackText={senderName} />
        </div>
      )}

      <div onClick={() => onMessageClick(msg)} title={msg.out ? "O'chirish yoki javob berish uchun bosing" : "Javob berish uchun bosing"}
        style={{ padding: '6px 12px 4px 12px', borderRadius: '12px', backgroundColor: msg.out ? theme.messageOut : theme.messageIn, color: theme.text, boxShadow: '0 1px 2px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', cursor: 'pointer', userSelect: 'none', opacity: msg.isDeleted ? 0.8 : 1 }}>
        
        {msg.isDeleted && (
           <div style={{ fontSize: '11px', color: '#dc3545', fontWeight: 'bold', marginBottom: '4px', borderBottom: '1px dotted #dc3545', paddingBottom: '2px' }}>
             🗑 O'chirilgan xabar (Anti-Delete)
           </div>
        )}

        {showSenderInfo && (
          <div onClick={(e) => { e.stopPropagation(); onSenderProfileClick(msg.sender, senderName); }} 
               style={{ color: getAvatarColor(msg.sender?.id?.toString()), fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', cursor: 'pointer', textDecoration: msg.isDeleted ? 'line-through' : 'none' }}>
            {senderName}
          </div>
        )}

        {msg.replyToMsgId && (
          <div style={{ borderLeft: `3px solid ${msg.out ? '#fff' : '#0088cc'}`, paddingLeft: '8px', marginBottom: '6px', fontSize: '13px', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', padding: '4px 8px' }}>
            <span style={{fontWeight: 'bold', color: msg.out ? '#fff' : '#0088cc', display: 'block', fontSize: '11px'}}>Javob</span>
            <span style={{ opacity: 0.9, color: theme.text }}>{repliedMsg ? (repliedMsg.message || "📷 Media") : "..."}</span>
          </div>
        )}
        {mediaUrl && <img src={mediaUrl} alt="Media" style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', marginBottom: '5px', objectFit: 'contain', filter: msg.isDeleted ? 'grayscale(50%)' : 'none' }} />}
        {msg.message && <span style={{ fontSize: '15px', wordBreak: 'break-word', marginBottom: '2px', color: theme.text, textDecoration: msg.isDeleted ? 'line-through' : 'none' }}>{msg.message}</span>}
        {msg.media && !msg.media.photo && <span style={{ fontSize: '14px', fontStyle: 'italic', color: theme.textMuted, marginBottom: '2px', textDecoration: msg.isDeleted ? 'line-through' : 'none' }}>{msg.media.voice ? "🎤 Ovozli xabar" : "📁 Fayl / Video / Stiker"}</span>}
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', fontSize: '11px', color: theme.textMuted, height: '14px' }}>
          <span>{msgTime}</span>
          {msg.out && <span style={{ color: isRead ? '#34b7f1' : theme.textMuted, fontSize: '13px', fontWeight: 'bold' }}>{isRead ? '✓✓' : '✓'}</span>}
        </div>
      </div>
    </div>
  );
};

function App() {
  const [loginMode, setLoginMode] = useState('user'); 
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [password, setPassword] = useState(''); 
  const [botToken, setBotToken] = useState(''); 
  
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
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserFull, setCurrentUserFull] = useState(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState('');
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editBioText, setEditBioText] = useState("");
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editUsernameText, setEditUsernameText] = useState("");

  const [viewProfileModal, setViewProfileModal] = useState(false);
  const [viewProfileData, setViewProfileData] = useState(null);
  const [viewProfileLoading, setViewProfileLoading] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiMenuTab, setEmojiMenuTab] = useState('emoji');

  const [stories, setStories] = useState([]);
  const [activeStory, setActiveStory] = useState(null); 
  const [storyMedia, setStoryMedia] = useState(null); 
  const [isStoryLoading, setIsStoryLoading] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isGhostMode, setIsGhostMode] = useState(false);
  const isGhostModeRef = useRef(isGhostMode);
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

  const TABS = [
    { id: 'all', label: 'Barchasi' }, { id: 'users', label: 'Shaxsiy' },
    { id: 'groups', label: 'Guruhlar' }, { id: 'channels', label: 'Kanallar' },
    { id: 'bots', label: 'Botlar' }
  ];

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // MUHIM QISMI: Tizimga avtomatik kirish va chatlarni qayta tiklash
  useEffect(() => {
    const savedTheme = localStorage.getItem("squarix_theme");
    if (savedTheme === "dark") setIsDarkMode(true);
    
    const savedGhost = localStorage.getItem("squarix_ghost");
    if (savedGhost === "true") {
      setIsGhostMode(true);
      isGhostModeRef.current = true;
    }

    const savedSession = localStorage.getItem("squarix_session");
    if (savedSession) { 
        setStep(4); 
        const tgClient = new TelegramClient(new StringSession(savedSession), apiId, apiHash, { connectionRetries: 5 });
        tgClient.connect().then(() => {
            globalTgClient = tgClient;
            setClient(tgClient);
            fetchInitialData(tgClient);
        }).catch(e => {
            if (e.message && (e.message.includes("AUTH") || e.message.includes("REVOKED") || e.message.includes("DEACTIVATED"))) {
                localStorage.removeItem("squarix_session");
                window.location.reload();
            }
        });
    }
  }, []);

  // YANGI: Botlar uchun chatlarni xotirada saqlash
  useEffect(() => {
    if (currentUser && currentUser.bot && chats.length > 0) {
      // Faqat kerakli ma'lumotlarni saqlaymiz (xotira to'lib ketmasligi uchun)
      const botChatIds = chats.map(c => c.id.toString());
      localStorage.setItem("squarix_bot_chats", JSON.stringify(botChatIds));
    }
  }, [chats, currentUser]);

  const toggleThemeFunc = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem("squarix_theme", newTheme ? "dark" : "light");
  };

  const toggleGhostMode = () => {
    const newGhost = !isGhostMode;
    setIsGhostMode(newGhost);
    isGhostModeRef.current = newGhost;
    localStorage.setItem("squarix_ghost", newGhost ? "true" : "false");
  };

  const handleLogout = async () => {
    const confirmLogout = window.confirm("Haqiqatan ham akkauntdan chiqmoqchimisiz?");
    if (!confirmLogout) return;
    try {
      if (client) await client.invoke(new Api.auth.LogOut());
    } catch (e) {}
    localStorage.removeItem("squarix_session");
    localStorage.removeItem("squarix_bot_chats");
    window.location.reload(); 
  };

  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!client) return;
    
    const handleNewMessage = async (event) => {
      const message = event.message;
      const currentChat = activeChatRef.current;
      
      let isNewChat = false;
      
      setChats(prevChats => {
        const chatIndex = prevChats.findIndex(c => String(c.id).replace('-100','') === String(message.chatId).replace('-100',''));
        if (chatIndex > -1) {
          const newChats = [...prevChats];
          const chatToUpdate = { ...newChats[chatIndex], message: message };
          
          if (!message.out && String(chatToUpdate.id).replace('-100','') !== String(currentChat?.id).replace('-100','')) {
            chatToUpdate.dialog = { ...chatToUpdate.dialog, unreadCount: (chatToUpdate.dialog?.unreadCount || 0) + 1 };
          }
          newChats.splice(chatIndex, 1);
          newChats.unshift(chatToUpdate);
          return newChats;
        } else {
          isNewChat = true;
          return prevChats;
        }
      });

      if (isNewChat) {
         try {
            const entity = await client.getEntity(message.chatId);
            const newChat = {
               id: message.chatId,
               entity: entity,
               title: entity.title || entity.firstName || "Yangi chat",
               isUser: entity.className === 'User',
               isGroup: entity.className === 'Chat' || entity.megagroup,
               isChannel: entity.className === 'Channel' && !entity.megagroup,
               dialog: { unreadCount: 1 },
               message: message
            };
            setChats(prev => {
               if (prev.some(c => String(c.id).replace('-100','') === String(message.chatId).replace('-100',''))) return prev;
               return [newChat, ...prev];
            });
         } catch (e) { console.log(e); }
      }

      if (currentChat && message.chatId) {
        const msgId = String(message.chatId).replace('-100', '');
        const chatId = String(currentChat.id).replace('-100', '');
        if (msgId === chatId) {
          setMessages(prev => {
            if (prev.some(m => m.id === message.id)) return prev;
            return [...prev, message];
          });
          
          if (!isGhostModeRef.current && !message.out) {
            try {
              await client.invoke(new Api.messages.ReadHistory({ peer: currentChat.entity, maxId: 0 }));
            } catch (e) {}
          }
        }
      }
    };

    const handleRawEvent = (event) => {
       if (event.className === 'UpdateDeleteMessages' || event.className === 'UpdateDeleteChannelMessages') {
           const deletedIds = event.messages;
           if (!deletedIds || deletedIds.length === 0) return;

           setMessages(prev => prev.map(msg => {
               if (deletedIds.includes(msg.id)) {
                   return { ...msg, isDeleted: true };
               }
               return msg;
           }));

           setChats(prevChats => prevChats.map(c => {
               if (c.message && deletedIds.includes(c.message.id)) {
                    return { ...c, message: { ...c.message, isDeleted: true }};
               }
               return c;
           }));
       }
    };

    client.addEventHandler(handleNewMessage, new NewMessage({ incoming: true, outgoing: true }));
    client.addEventHandler(handleRawEvent, new Raw({})); 

    return () => {
      client.removeEventHandler(handleNewMessage, new NewMessage({ incoming: true, outgoing: true }));
      client.removeEventHandler(handleRawEvent, new Raw({}));
    }
  }, [client]);

  const fetchInitialData = async (tgClient) => {
    if (!tgClient) return;
    setLoadingChats(true);
    try {
      const me = await tgClient.getMe();
      setCurrentUser(me);
      
      try {
        const fullMe = await tgClient.invoke(new Api.users.GetFullUser({ id: me.id }));
        setCurrentUserFull(fullMe);
      } catch (e) {}

      try {
        if (me.photo) {
          const buffer = await tgClient.downloadProfilePhoto(me);
          if (buffer && buffer.length > 0) setMyPhotoUrl(URL.createObjectURL(new Blob([buffer], { type: 'image/jpeg' })));
        }
      } catch (e) {}
      
      if (!me.bot) {
         // Oddiy foydalanuvchi
         const dialogs = await tgClient.getDialogs({ limit: 100 }); 
         setChats(dialogs);

         try {
           const storiesResult = await tgClient.invoke(new Api.stories.GetAllStories({}));
           if (storiesResult && storiesResult.peerStories) {
             setStories(storiesResult.peerStories);
           }
         } catch (err) {}
      } else {
         // YANGI MANTIQ: Bot uchun keshni yuklash!
         const cachedBotChats = localStorage.getItem("squarix_bot_chats");
         if (cachedBotChats) {
            const parsedIds = JSON.parse(cachedBotChats);
            const restoredChats = [];
            for (let id of parsedIds) {
                try {
                    const entity = await tgClient.getEntity(id);
                    // Bot o'sha chatdagi oxirgi xabarni oladi
                    const msgs = await tgClient.getMessages(entity, { limit: 1 });
                    const lastMsg = msgs.length > 0 ? msgs[0] : null;

                    restoredChats.push({
                        id: entity.id,
                        entity: entity,
                        title: entity.title || entity.firstName || "Chat",
                        isUser: entity.className === 'User',
                        isGroup: entity.className === 'Chat' || entity.megagroup,
                        isChannel: entity.className === 'Channel' && !entity.megagroup,
                        dialog: { unreadCount: 0 },
                        message: lastMsg
                    });
                } catch (e) {
                   console.log("Keshdan chat tiklashda xato:", e);
                }
            }
            setChats(restoredChats);
         } else {
            setChats([]); 
         }
      }
    } catch (error) { 
      const errText = error.message ? error.message.toUpperCase() : "";
      if (errText.includes("AUTH_KEY_UNREGISTERED") || errText.includes("REVOKED") || errText.includes("DEACTIVATED")) {
        alert("Sessiya yaroqsiz! Qaytadan kiring.");
        localStorage.removeItem("squarix_session");
        window.location.reload(); 
      }
    }
    setLoadingChats(false);
  };

  const sendCode = async () => {
    if (!phoneNumber) return;
    try {
      const newClient = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 5 });
      await newClient.connect();
      const result = await newClient.sendCode({ apiId, apiHash }, phoneNumber);
      
      globalTgClient = newClient;
      setClient(newClient);
      setPhoneCodeHash(result.phoneCodeHash);
      setStep(2);
    } catch (error) { alert("Xatolik (Raqamni tekshiring): " + error.message); }
  };

  const verifyCode = async () => {
    if (!phoneCode || !client) return;
    try {
      await client.signIn({ phoneNumber, phoneCodeHash, phoneCode });
      localStorage.setItem("squarix_session", client.session.save());
      setStep(4);
      fetchInitialData(client); 
    } catch (error) { 
      if (error.message && error.message.includes('SESSION_PASSWORD_NEEDED')) {
         setStep(3); 
      } else {
         alert("Kod xatosi: " + error.message); 
      }
    }
  };

  const verifyPassword = async () => {
    if (!password || !client) return;
    try {
       await client.checkPassword(password);
       localStorage.setItem("squarix_session", client.session.save());
       setStep(4);
       fetchInitialData(client);
    } catch (error) {
       alert("Parol noto'g'ri: " + error.message);
    }
  };

  const handleBotLogin = async () => {
    if (!botToken) return;
    try {
      const newClient = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 5 });
      await newClient.start({ botAuthToken: botToken });
      
      globalTgClient = newClient;
      setClient(newClient);
      localStorage.setItem("squarix_session", newClient.session.save());
      setStep(4);
      fetchInitialData(newClient);
    } catch (error) {
      alert("Bot token noto'g'ri: " + error.message);
    }
  };

  const openChat = async (chat) => {
    if (!client) return;
    
    // Eski xabarlarni tozalash o'rniga, sekin yuklanmasligi uchun
    // Agar boshqa chat ochilayotgan bo'lsa tozalaymiz
    if (activeChat?.id !== chat.id) {
       setMessages([]); 
    }
    
    setActiveChat(chat);
    setNewMessage('');
    setIsRecording(false); 
    setReplyingTo(null); 
    setShowEmojiPicker(false);
    
    setChats(prev => prev.map(c => {
      if (c.id === chat.id) return { ...c, dialog: { ...c.dialog, unreadCount: 0 } };
      return c;
    }));

    try {
      const msgs = await client.getMessages(chat.entity, { limit: 100 });
      setMessages(msgs.reverse()); 

      if (!isGhostModeRef.current) {
        await client.invoke(new Api.messages.ReadHistory({ peer: chat.entity, maxId: 0 }));
      }
    } catch (error) {}
  };

  const startDirectChat = () => {
    if (!viewProfileData || !viewProfileData.entity) return;
    const targetEntity = viewProfileData.entity;
    const targetIdStr = String(targetEntity.id).replace('-100', '');
    setViewProfileModal(false); 
    
    let existingChat = chats.find(c => String(c.id).replace('-100', '') === targetIdStr);
    
    if (existingChat) {
      openChat(existingChat);
      setActiveTab('all');
    } else {
      const isUser = targetEntity.className === 'User' || targetEntity.isUser;
      const newChat = {
        id: targetEntity.id,
        entity: targetEntity,
        title: viewProfileData.title,
        isUser: isUser,
        isGroup: targetEntity.className === 'Chat' || targetEntity.megagroup,
        isChannel: targetEntity.className === 'Channel' && !targetEntity.megagroup,
        dialog: { unreadCount: 0 },
        message: null
      };
      setChats(prev => [newChat, ...prev]);
      openChat(newChat);
      setActiveTab('all');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChat || !client) return;
    const textToSend = newMessage;
    setNewMessage('');
    setShowEmojiPicker(false);
    try {
      const sentMessage = await client.sendMessage(activeChat.entity, { message: textToSend, replyTo: replyingTo ? replyingTo.id : undefined });
      setReplyingTo(null); 
      setMessages(prev => [...prev, sentMessage]);
    } catch (error) { alert("Xabarni yuborib bo'lmadi!"); }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!client) return;
    try {
      await client.deleteMessages(activeChat.entity, [msgId], { revoke: true });
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true } : m));
    } catch (error) { alert("Xabarni o'chirib bo'lmadi!"); }
  };

  const handleMediaUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !activeChat || !client) return;
    setSendingMedia(true);
    const textToSend = newMessage;
    setNewMessage('');
    setShowEmojiPicker(false);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const cleanFile = new File([buffer], file.name, { type: file.type });
      const uploadedFile = await client.uploadFile({ file: cleanFile, workers: 1 });
      const sentMessage = await client.sendMessage(activeChat.entity, { message: textToSend, file: uploadedFile, replyTo: replyingTo ? replyingTo.id : undefined });
      setReplyingTo(null);
      setMessages(prev => [...prev, sentMessage]);
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
            const uploadedFile = await client.uploadFile({ file: file, workers: 1 });
            const sentMessage = await client.sendMessage(activeChat.entity, { file: uploadedFile, voiceNote: true, replyTo: replyingTo ? replyingTo.id : undefined });
            setReplyingTo(null);
            setMessages(prev => [...prev, sentMessage]);
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
    if (!file || !client) return;
    setUploadingPhoto(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const cleanFile = new File([buffer], file.name, { type: file.type });
      const uploadedFile = await client.uploadFile({ file: cleanFile, workers: 1 });
      await client.invoke(new Api.photos.UploadProfilePhoto({ file: uploadedFile }));
      alert("Profil rasmingiz yangilandi!");
      const me = await client.getMe();
      const photoBuffer = await client.downloadProfilePhoto(me);
      if (photoBuffer && photoBuffer.length > 0) setMyPhotoUrl(URL.createObjectURL(new Blob([photoBuffer], { type: 'image/jpeg' })));
    } catch (error) { alert("Rasm yuklashda xato!"); } 
    finally { setUploadingPhoto(false); }
  };

  const handleSaveBio = async () => {
    if (!client) return;
    try {
      await client.invoke(new Api.account.UpdateProfile({ about: editBioText }));
      setCurrentUserFull(prev => ({ ...prev, fullUser: { ...prev.fullUser, about: editBioText } }));
      setIsEditingBio(false);
    } catch (e) { alert("Tarjimai holni saqlashda xatolik!"); }
  };

  const handleSaveUsername = async () => {
    if (!client) return;
    try {
      await client.invoke(new Api.account.UpdateUsername({ username: editUsernameText }));
      setCurrentUser(prev => ({ ...prev, username: editUsernameText }));
      setIsEditingUsername(false);
    } catch (e) { alert("Username saqlashda xatolik! Ehtimol band yoki noto'g'ri."); }
  };

  const handleOpenUserProfile = async (targetEntity, fallbackTitle) => {
    if (!targetEntity || !client) return;
    setViewProfileModal(true);
    
    const idStr = targetEntity.id ? targetEntity.id.toString() : null;
    let initialPhotos = [];
    if (idStr && globalAvatarCache.has(idStr)) {
       initialPhotos.push(globalAvatarCache.get(idStr));
    }

    setViewProfileData({ 
       photos: initialPhotos, 
       full: null, 
       entity: targetEntity,
       title: targetEntity.firstName || targetEntity.title || fallbackTitle,
       username: targetEntity.username,
       phone: targetEntity.phone,
       id: idStr
    });
    
    setViewProfileLoading(true);
    try {
      let photosUrls = [...initialPhotos];
      if (targetEntity.className === 'User' || targetEntity.isUser) {
        const photos = await client.invoke(new Api.photos.GetUserPhotos({ userId: targetEntity, offset: 0, maxId: 0, limit: 10 }));
        if(photos && photos.photos) {
           photosUrls = []; 
           for(let photo of photos.photos) {
             const buffer = await client.downloadMedia(photo);
             if(buffer && buffer.length > 0) photosUrls.push(URL.createObjectURL(new Blob([buffer], { type: 'image/jpeg' })));
           }
        }
      } else {
        const buffer = await client.downloadProfilePhoto(targetEntity);
        if (buffer && buffer.length > 0) {
           photosUrls = [URL.createObjectURL(new Blob([buffer], { type: 'image/jpeg' }))];
        }
      }

      let fullInfo = null;
      if (targetEntity.className === 'User' || targetEntity.isUser) fullInfo = await client.invoke(new Api.users.GetFullUser({ id: targetEntity }));
      else if (targetEntity.className === 'Channel' || targetEntity.isChannel || targetEntity.isGroup) fullInfo = await client.invoke(new Api.channels.GetFullChannel({ channel: targetEntity }));
      
      setViewProfileData(prev => ({ ...prev, photos: photosUrls, full: fullInfo }));
    } catch (error) {}
    setViewProfileLoading(false);
  };

  const closeStoryViewer = () => {
    setActiveStory(null);
    setStoryMedia(null);
    setStoryProgress(0);
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

  const getRepliedMsg = (id) => { if (!id) return null; return messages.find(m => m.id === id); };

  if (step < 4) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '50px', fontFamily: 'sans-serif' }}>
        <h1>Squarix Web 🚀</h1>
        
        {step === 1 && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', backgroundColor: '#f0f2f5', padding: '5px', borderRadius: '10px' }}>
             <button onClick={() => setLoginMode('user')} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', backgroundColor: loginMode === 'user' ? '#0088cc' : 'transparent', color: loginMode === 'user' ? 'white' : '#555', fontWeight: 'bold', transition: '0.3s' }}>👤 Shaxsiy Akkaunt</button>
             <button onClick={() => setLoginMode('bot')} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', backgroundColor: loginMode === 'bot' ? '#0088cc' : 'transparent', color: loginMode === 'bot' ? 'white' : '#555', fontWeight: 'bold', transition: '0.3s' }}>🤖 Bot Token</button>
          </div>
        )}

        {step === 1 && loginMode === 'user' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '300px' }}>
            <input type="text" placeholder="+998..." value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} style={{ padding: '12px', fontSize: '16px', color: 'black', borderRadius: '8px', border: '1px solid #ccc' }} />
            <button onClick={sendCode} style={{ padding: '12px', cursor: 'pointer', backgroundColor: '#0088cc', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Kodni olish</button>
          </div>
        )}

        {step === 1 && loginMode === 'bot' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '300px' }}>
            <p style={{ textAlign: 'center', margin: '0 0 10px 0', fontSize: '13px', color: '#555' }}>BotFather'dan olingan tokenni kiriting.</p>
            <input type="text" placeholder="123456:ABC-DEF..." value={botToken} onChange={(e) => setBotToken(e.target.value)} style={{ padding: '12px', fontSize: '14px', color: 'black', borderRadius: '8px', border: '1px solid #ccc' }} />
            <button onClick={handleBotLogin} style={{ padding: '12px', cursor: 'pointer', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Bot sifatida kirish</button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '300px' }}>
            <input type="text" placeholder="Kod..." value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} style={{ padding: '12px', fontSize: '16px', color: 'black', borderRadius: '8px', border: '1px solid #ccc' }} />
            <button onClick={verifyCode} style={{ padding: '12px', cursor: 'pointer', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Kirish</button>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', width: '300px' }}>
            <p style={{ color: 'black', textAlign: 'center', fontWeight: 'bold' }}>Sizning hisobingiz 2-bosqichli parol bilan himoyalangan 🔒</p>
            <input type="password" placeholder="Parol..." value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '12px', fontSize: '16px', color: 'black', width: '100%', borderRadius: '8px', border: '1px solid #ccc' }} />
            <button onClick={verifyPassword} style={{ padding: '12px', cursor: 'pointer', backgroundColor: '#0088cc', color: '#fff', width: '100%', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Tastiqlash</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: 'sans-serif', margin: '-8px', backgroundColor: theme.bg, overflow: 'hidden' }}>
      
      {selectedMessage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setSelectedMessage(null)}>
          <div style={{ backgroundColor: theme.panelBg, padding: '20px', borderRadius: '15px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <h4 style={{ margin: '0 0 5px 0', color: theme.text, textAlign: 'center' }}>Amalni tanlang</h4>
            <button onClick={() => { setReplyingTo(selectedMessage); setSelectedMessage(null); }} style={{ padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#0088cc', color: 'white', fontSize: '15px', cursor: 'pointer', fontWeight: 'bold' }}>↪️ Javob berish (Reply)</button>
            {selectedMessage.out && <button onClick={() => { handleDeleteMessage(selectedMessage.id); setSelectedMessage(null); }} style={{ padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#dc3545', color: 'white', fontSize: '15px', cursor: 'pointer', fontWeight: 'bold' }}>🗑 Hammadan o'chirish</button>}
            <button onClick={() => setSelectedMessage(null)} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: 'transparent', color: theme.text, fontSize: '15px', cursor: 'pointer', marginTop: '5px' }}>Bekor qilish</button>
          </div>
        </div>
      )}

      {viewProfileModal && viewProfileData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setViewProfileModal(false)}>
          <div style={{ backgroundColor: theme.panelBg, width: '380px', maxWidth: '90%', maxHeight: '90vh', borderRadius: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '15px 20px', backgroundColor: '#0088cc', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 20 }}>
              <h3 style={{ margin: 0 }}>Profil ma'lumotlari</h3>
              <button onClick={() => setViewProfileModal(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              {viewProfileLoading && <div style={{ position: 'absolute', top: '5px', right: '10px', color: '#fff', fontSize: '12px', background: 'rgba(0,0,0,0.5)', padding: '2px 5px', borderRadius: '5px', zIndex: 10 }}>Yuklanmoqda... ⏳</div>}

              <div style={{ width: '100%', height: '280px', display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', backgroundColor: getAvatarColor(viewProfileData.id) }}>
                 {viewProfileData.photos && viewProfileData.photos.length > 0 ? (
                    viewProfileData.photos.map((url, i) => (
                      <img key={i} src={url} alt="Profile" onError={(e) => e.target.style.display='none'} style={{ width: '100%', height: '100%', objectFit: 'cover', flex: '0 0 100%', scrollSnapAlign: 'start' }} />
                    ))
                 ) : (
                    <div style={{ width: '100%', height: '100%', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '80px', flex: '0 0 100%' }}>
                       {viewProfileData.title?.charAt(0) || '?'}
                    </div>
                 )}
              </div>

              <div style={{ padding: '20px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}>
                <h2 style={{ margin: '0 0 5px 0', color: theme.text, fontSize: '22px', textAlign: 'center' }}>{viewProfileData.title}</h2>
                {viewProfileData.username && <p style={{ margin: '0 0 15px 0', color: '#0088cc', fontSize: '15px' }}>@{viewProfileData.username}</p>}
                
                <div style={{ width: '100%', backgroundColor: theme.chatBg, padding: '15px', borderRadius: '10px', marginTop: '10px', boxSizing: 'border-box' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: 'bold' }}>Tarjimai hol (Bio) / Info:</span>
                    <p style={{ margin: '5px 0 0', color: theme.text, fontSize: '15px' }}>{viewProfileData.full?.fullUser?.about || viewProfileData.full?.fullChat?.about || (viewProfileLoading ? "Ma'lumot olinmoqda..." : "Ma'lumot kiritilmagan")}</p>
                  </div>
                  {viewProfileData.phone && (
                    <div>
                      <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: 'bold' }}>Telefon raqam:</span>
                      <p style={{ margin: '5px 0 0', color: theme.text, fontSize: '15px' }}>+{viewProfileData.phone}</p>
                    </div>
                  )}
                  <div style={{ marginTop: '10px' }}>
                    <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: 'bold' }}>ID Raqam:</span>
                    <p style={{ margin: '5px 0 0', color: theme.text, fontSize: '14px' }}>{String(viewProfileData.id).replace('-100', '')}</p>
                  </div>
                </div>

                {String(viewProfileData.id) !== String(currentUser?.id) && (
                  <button 
                    onClick={startDirectChat}
                    style={{ width: '100%', padding: '14px', marginTop: '15px', backgroundColor: '#0088cc', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', transition: '0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#007bb5'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0088cc'}
                  >
                    {(viewProfileData.entity?.className === 'User' || viewProfileData.entity?.isUser) ? "💬 Xabar yozish" : "👁 Chatga o'tish"}
                  </button>
                )}

              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: (isMobile && activeChat) ? 'none' : 'flex', width: isMobile ? '100%' : '320px', backgroundColor: theme.panelBg, borderRight: `1px solid ${theme.border}`, flexDirection: 'column' }}>
        {showProfileSettings ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: theme.bg, overflowY: 'auto' }}>
            <div style={{ padding: '15px 20px', backgroundColor: '#0088cc', color: 'white', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <button onClick={() => setShowProfileSettings(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}>←</button>
              <h3 style={{ margin: 0 }}>Profil sozlamalari</h3>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: theme.panelBg, borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ position: 'relative', marginBottom: '15px' }}>
                {myPhotoUrl ? <img src={myPhotoUrl} alt="Profil" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #0088cc' }} /> : <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: '#0088cc', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '40px', fontWeight: 'bold' }}>{currentUser?.firstName?.charAt(0) || 'U'}</div>}
              </div>
              <h2 style={{ margin: '0 0 5px 0', fontSize: '20px', color: theme.text }}>{currentUser?.firstName} {currentUser?.lastName}</h2>
              {currentUser?.phone && <p style={{ margin: 0, color: theme.textMuted, fontSize: '15px' }}>+{currentUser?.phone}</p>}
            </div>
            
            <div style={{ padding: '15px 20px', backgroundColor: theme.panelBg, marginTop: '10px', borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ marginBottom: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#0088cc', fontWeight: 'bold' }}>Tarjimai hol (Bio)</p>
                  {!isEditingBio ? (
                    <button onClick={() => { setEditBioText(currentUserFull?.fullUser?.about || ""); setIsEditingBio(true); }} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: '15px' }}>✏️</button>
                  ) : (
                    <button onClick={handleSaveBio} style={{ background: 'none', border: 'none', color: '#28a745', cursor: 'pointer', fontWeight: 'bold' }}>Saqlash</button>
                  )}
                </div>
                {!isEditingBio ? (
                  <p style={{ margin: '5px 0 0 0', fontSize: '15px', color: theme.text }}>{currentUserFull?.fullUser?.about || "Ma'lumot kiritilmagan"}</p>
                ) : (
                  <input type="text" value={editBioText} onChange={e => setEditBioText(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '5px', border: `1px solid ${theme.border}`, backgroundColor: theme.inputBg, color: theme.text, outline: 'none' }} placeholder="O'zingiz haqingizda yozing..." />
                )}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: '0', fontSize: '13px', color: '#0088cc', fontWeight: 'bold' }}>Username</p>
                  {!isEditingUsername ? (
                    <button onClick={() => { setEditUsernameText(currentUser?.username || ""); setIsEditingUsername(true); }} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: '15px' }}>✏️</button>
                  ) : (
                    <button onClick={handleSaveUsername} style={{ background: 'none', border: 'none', color: '#28a745', cursor: 'pointer', fontWeight: 'bold' }}>Saqlash</button>
                  )}
                </div>
                {!isEditingUsername ? (
                  <p style={{ margin: '5px 0 0 0', fontSize: '15px', color: theme.text }}>{currentUser?.username ? `@${currentUser.username}` : "Username o'rnatilmagan"}</p>
                ) : (
                  <input type="text" value={editUsernameText} onChange={e => setEditUsernameText(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px', borderRadius: '5px', border: `1px solid ${theme.border}`, backgroundColor: theme.inputBg, color: theme.text, outline: 'none' }} placeholder="Faqat lotin harflari va raqamlar" />
                )}
              </div>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <input type="file" id="profilePic" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePhotoUpload} />
              <label htmlFor="profilePic" style={{ display: 'block', width: '100%', padding: '12px', backgroundColor: '#28a745', color: 'white', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', fontSize: '15px', fontWeight: 'bold' }}>Rasmni o'zgartirish 📷</label>
              
              <button onClick={handleLogout} style={{ width: '100%', padding: '12px', backgroundColor: '#dc3545', color: 'white', borderRadius: '8px', cursor: 'pointer', border: 'none', fontSize: '15px', fontWeight: 'bold' }}>Akkauntdan chiqish 🚪</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '10px 15px', backgroundColor: '#0088cc', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {myPhotoUrl ? <img src={myPhotoUrl} alt="Me" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#005f8f', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>{currentUser?.firstName?.charAt(0) || 'S'}</div>}
                <div style={{ display: 'flex', flexDirection: 'column' }}><h3 style={{ margin: 0, fontSize: '15px' }}>{currentUser?.firstName || '...'}</h3><span style={{ fontSize: '11px', color: '#b3e5fc' }}>Squarix Web</span></div>
              </div>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <button onClick={toggleGhostMode} title={isGhostMode ? "Ghost rejim yoniq (Birovga o'qilganingiz ko'rinmaydi)" : "Ghost rejim o'chiq"} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 5px', opacity: isGhostMode ? 1 : 0.4, transition: '0.3s' }}>👻</button>
                <button onClick={toggleThemeFunc} title="Tungi rejim" style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer', padding: '0 5px' }}>{isDarkMode ? '☀️' : '🌙'}</button>
                <button onClick={() => setShowProfileSettings(true)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '22px', cursor: 'pointer', padding: '0 5px' }}>⋮</button>
              </div>
            </div>

            <div style={{ display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${theme.border}`, backgroundColor: theme.panelBg }}>
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: '1', padding: '10px 5px', border: 'none', backgroundColor: 'transparent', color: activeTab === tab.id ? '#0088cc' : theme.textMuted, borderBottom: activeTab === tab.id ? '3px solid #0088cc' : '3px solid transparent', cursor: 'pointer', fontSize: '13px', fontWeight: activeTab === tab.id ? 'bold' : 'normal', transition: 'all 0.2s' }}>{tab.label}</button>
              ))}
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', backgroundColor: theme.panelBg }}>
              {loadingChats && <div style={{ padding: '20px', textAlign: 'center', color: theme.textMuted }}>Yuklanmoqda...</div>}
              
              {chats.length === 0 && !loadingChats && currentUser?.bot && (
                <div style={{ padding: '20px', textAlign: 'center', color: theme.textMuted, fontSize: '14px' }}>
                   🤖 Siz Bot panelidasiz. Chatlar bu yerda kimdir sizga yozgandagina paydo bo'ladi. <br/><br/>
                   Hozircha bo'sh, ammo kimdir yozishi bilan bu yerda saqlanib qoladi!
                </div>
              )}

              {filteredChats.map((chat, idx) => {
                let isListRead = false;
                const isListOut = chat.message?.out;
                if (isListOut && chat.dialog && chat.message?.id <= chat.dialog.readOutboxMaxId) isListRead = true;
                
                const unreadCount = chat.dialog?.unreadCount || 0;
                const isMsgDeleted = chat.message?.isDeleted;

                return (
                <div key={idx} onClick={() => openChat(chat)} style={{ padding: '10px 15px', borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', backgroundColor: activeChat?.id === chat.id ? theme.activeChat : 'transparent', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <LazyAvatar client={client} entity={chat.entity} size={50} fallbackText={chat.title} />
                  <div style={{ overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '600' }}>{chat.title}</h4>
                      {chat.message?.date && (
                        <span style={{ fontSize: '11px', color: theme.textMuted }}>{new Date(chat.message.date * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      {isListOut && <span style={{ color: isListRead ? '#34b7f1' : theme.textMuted, fontSize: '12px', fontWeight: 'bold' }}>{isListRead ? '✓✓' : '✓'}</span>}
                      
                      <p style={{ margin: 0, fontSize: '14px', color: isMsgDeleted ? '#dc3545' : theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                        {isMsgDeleted ? "🗑 O'chirilgan xabar" : (chat.message?.message || (chat.message?.media ? "[Media]" : "Xabar yo'q"))}
                      </p>
                      
                      {unreadCount > 0 && (
                        <div style={{ backgroundColor: '#28a745', color: 'white', borderRadius: '10px', padding: '2px 6px', fontSize: '11px', fontWeight: 'bold', marginLeft: 'auto' }}>
                          {unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )})}
            </div>
          </>
        )}
      </div>

      <div style={{ display: (isMobile && !activeChat) ? 'none' : 'flex', flex: 1, flexDirection: 'column', backgroundColor: theme.chatBg, position: 'relative' }}>
        {activeChat ? (
          <>
            <div onClick={() => handleOpenUserProfile(activeChat.entity, activeChat.title)} title="Profilni ko'rish uchun bosing" style={{ padding: '10px 15px', backgroundColor: theme.panelBg, borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', zIndex: 10 }}>
              {isMobile && <button onClick={(e) => { e.stopPropagation(); setActiveChat(null); }} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '0 10px 0 0', color: '#0088cc' }}>←</button>}
              <LazyAvatar client={client} entity={activeChat.entity} size={42} fallbackText={activeChat.title} />
              <div style={{ overflow: 'hidden' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeChat.title}</h3>
                <span style={{ fontSize: '12px', color: theme.textMuted }}>{activeChat.entity?.bot ? "Bot" : activeChat.isGroup ? "Guruh" : activeChat.isChannel ? "Kanal" : "Shaxsiy"}</span>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }} onClick={() => setShowEmojiPicker(false)}>
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
                   onSenderProfileClick={handleOpenUserProfile} 
                />
              ))}
              {sendingMedia && <div style={{ alignSelf: 'flex-end', padding: '8px 15px', backgroundColor: theme.activeChat, borderRadius: '10px', color: theme.text, fontSize: '13px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>Kuting, jo'natilmoqda... ⏳</div>}
              <div ref={messagesEndRef} />
            </div>

            {replyingTo && (
              <div style={{ padding: '8px 20px', backgroundColor: theme.activeChat, borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ borderLeft: '3px solid #0088cc', paddingLeft: '10px', overflow: 'hidden' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#0088cc', fontWeight: 'bold' }}>Javob berilyapti</p>
                  <p style={{ margin: '2px 0 0', fontSize: '14px', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyingTo.message || "📷 Media"}</p>
                </div>
                <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: theme.textMuted, fontSize: '20px', cursor: 'pointer' }}>✕</button>
              </div>
            )}

            {showEmojiPicker && (
              <div style={{ position: 'absolute', bottom: '70px', left: isMobile ? '10px' : '20px', backgroundColor: theme.panelBg, width: '320px', height: '350px', borderRadius: '15px', boxShadow: '0 5px 20px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', border: `1px solid ${theme.border}`, zIndex: 100 }}>
                <div style={{ display: 'flex', borderBottom: `1px solid ${theme.border}` }}>
                  <button onClick={() => setEmojiMenuTab('emoji')} style={{ flex: 1, padding: '10px', background: 'none', border: 'none', borderBottom: emojiMenuTab === 'emoji' ? '3px solid #0088cc' : '3px solid transparent', color: emojiMenuTab === 'emoji' ? '#0088cc' : theme.textMuted, cursor: 'pointer', fontWeight: 'bold' }}>Emoji 😀</button>
                  <button onClick={() => setEmojiMenuTab('sticker')} style={{ flex: 1, padding: '10px', background: 'none', border: 'none', borderBottom: emojiMenuTab === 'sticker' ? '3px solid #0088cc' : '3px solid transparent', color: emojiMenuTab === 'sticker' ? '#0088cc' : theme.textMuted, cursor: 'pointer', fontWeight: 'bold' }}>Stiker 🪧</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexWrap: 'wrap', gap: '5px', alignContent: 'flex-start' }}>
                  {emojiMenuTab === 'emoji' && EMOJIS.map((emoji, i) => (
                    <span key={i} onClick={() => setNewMessage(prev => prev + emoji)} style={{ fontSize: '24px', cursor: 'pointer', padding: '5px', borderRadius: '5px', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = theme.activeChat} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>{emoji}</span>
                  ))}
                  {emojiMenuTab === 'sticker' && (
                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: theme.textMuted, textAlign: 'center', padding: '20px' }}>
                      <span style={{ fontSize: '40px', marginBottom: '10px' }}>🪧</span><p>Stikerlar tez kunda!</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ padding: '12px 20px', backgroundColor: theme.inputPanel, display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="file" id="mediaUpload" style={{ display: 'none' }} onChange={handleMediaUpload} />
              <label htmlFor="mediaUpload" style={{ fontSize: '24px', cursor: 'pointer', color: theme.textMuted, padding: '0 5px' }}>📎</label>
              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: showEmojiPicker ? '#0088cc' : theme.textMuted, padding: '0 5px' }}>😀</button>
              <input type="text" placeholder={isRecording ? "🔴 Ovoz yozilmoqda (⏹ bosing)..." : "Xabar yozing..."} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !isRecording) sendMessage(); }} disabled={isRecording} style={{ flex: 1, padding: '14px 20px', borderRadius: '25px', border: `1px solid ${theme.border}`, outline: 'none', fontSize: '15px', color: theme.text, backgroundColor: isRecording ? (isDarkMode ? '#5c2b2f' : '#ffebee') : theme.inputBg }} />
              {newMessage.trim() && !isRecording ? (
                <button onClick={sendMessage} style={{ padding: '12px 20px', borderRadius: '25px', border: 'none', backgroundColor: '#0088cc', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>Yuborish</button>
              ) : (
                <button onClick={toggleRecording} style={{ width: '45px', height: '45px', borderRadius: '50%', border: 'none', backgroundColor: isRecording ? '#dc3545' : '#0088cc', color: 'white', cursor: 'pointer', fontSize: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: '0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>{isRecording ? '⏹' : '🎤'}</button>
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