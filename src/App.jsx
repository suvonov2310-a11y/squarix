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
          {msg.out && !activeChat?.entity?.bot && <span style={{ color: isRead ? '#34b7f1' : theme.textMuted, fontSize: '13px', fontWeight: 'bold' }}>{isRead ? '✓✓' : '✓'}</span>}
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
  const [isLoading, setIsLoading] = useState(false);
  
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMedia, setSendingMedia] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState('');
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const [viewProfileModal, setViewProfileModal] = useState(false);
  const [viewProfileData, setViewProfileData] = useState(null);
  const [viewProfileLoading, setViewProfileLoading] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiMenuTab, setEmojiMenuTab] = useState('emoji');

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
    chatBg: isDarkMode ? '#1e1e1e' : '#efeae2',
    panelBg: isDarkMode ? '#1a1a1a' : 'white',
    text: isDarkMode ? '#ffffff' : '#000000',
    textMuted: isDarkMode ? '#aaaaaa' : '#888888',
    border: isDarkMode ? '#333333' : '#e0e0e0',
    activeChat: isDarkMode ? '#2d2d2d' : '#f0f2f5',
    messageOut: isDarkMode ? '#2b5278' : '#dcf8c6',
    messageIn: isDarkMode ? '#2d2d2d' : 'white',
    inputBg: isDarkMode ? '#333333' : 'white',
    inputPanel: isDarkMode ? '#1a1a1a' : '#f0f2f5'
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
            localStorage.removeItem("squarix_session");
            window.location.reload();
        });
    }
  }, []);

  // Botning yozishmalarini uning ID siga qarab saqlaymiz (Har bir botning o'z oynasi bo'ladi)
  useEffect(() => {
    if (currentUser && currentUser.bot && chats.length > 0) {
      const botChatIds = chats.map(c => c.id.toString());
      localStorage.setItem(`squarix_bot_chats_${currentUser.id}`, JSON.stringify(botChatIds));
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
    const confirmLogout = window.confirm("Haqiqatan ham joriy akkauntdan chiqib, boshqasiga kirmoqchimisiz?");
    if (!confirmLogout) return;
    try {
      if (client) await client.invoke(new Api.auth.LogOut());
    } catch (e) {}
    localStorage.removeItem("squarix_session");
    window.location.reload(); 
  };

  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // JONLI EFIR (REAL-TIME XABARLAR)
  useEffect(() => {
    if (!client) return;
    
    const handleNewMessage = async (event) => {
      const message = event.message;
      const currentChat = activeChatRef.current;
      
      // Xabar kimdan yoki qayerdan kelganini aniqlash
      const peerIdObj = message.peerId;
      if (!peerIdObj) return;
      
      const peerId = peerIdObj.userId || peerIdObj.channelId || peerIdObj.chatId || message.chatId;
      const chatIdStr = String(peerId).replace('-100', '');
      
      let isNewChat = false;
      
      setChats(prevChats => {
        const chatIndex = prevChats.findIndex(c => String(c.id).replace('-100','') === chatIdStr);
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

      // Agar chat ro'yxatda yo'q bo'lsa (yangi mijoz yozsa yoki bot birinchi marta javob qaytarsa)
      if (isNewChat) {
         try {
            // Entitini olishga harakat qilamiz
            let entity = message.sender || message.chat;
            if (!entity) {
                try { entity = await client.getEntity(peerId); } catch(e) {}
            }
            
            if (entity) {
                const newChat = {
                   id: peerId,
                   entity: entity,
                   title: entity.title || entity.firstName || "Foydalanuvchi",
                   isUser: entity.className === 'User',
                   isGroup: entity.className === 'Chat' || entity.megagroup,
                   isChannel: entity.className === 'Channel' && !entity.megagroup,
                   dialog: { unreadCount: message.out ? 0 : 1 },
                   message: message
                };
                setChats(prev => {
                   if (prev.some(c => String(c.id).replace('-100','') === chatIdStr)) return prev;
                   return [newChat, ...prev];
                });
            }
         } catch (e) { console.log("Entity olishda xato:", e); }
      }

      // Agar foydalanuvchi aynan shu chatda bo'lsa
      if (currentChat && chatIdStr === String(currentChat.id).replace('-100', '')) {
          setMessages(prev => {
            if (prev.some(m => m.id === message.id)) return prev;
            return [...prev, message];
          });
          if (!isGhostModeRef.current && !message.out && !currentUser?.bot) {
            try { await client.invoke(new Api.messages.ReadHistory({ peer: currentChat.entity, maxId: 0 })); } catch (e) {}
          }
      }
    };

    client.addEventHandler(handleNewMessage, new NewMessage({ incoming: true, outgoing: true }));

    return () => {
      client.removeEventHandler(handleNewMessage, new NewMessage({ incoming: true, outgoing: true }));
    }
  }, [client, currentUser]);

  const fetchInitialData = async (tgClient) => {
    if (!tgClient) return;
    setLoadingChats(true);
    try {
      const me = await tgClient.getMe();
      setCurrentUser(me);
      
      try {
        if (me.photo) {
          const buffer = await tgClient.downloadProfilePhoto(me);
          if (buffer && buffer.length > 0) setMyPhotoUrl(URL.createObjectURL(new Blob([buffer], { type: 'image/jpeg' })));
        }
      } catch (e) {}
      
      if (!me.bot) {
         // Oddiy raqam uchun tarixni tortib kelish
         const dialogs = await tgClient.getDialogs({ limit: 100 }); 
         setChats(dialogs);
      } else {
         // BOT UCHUN: Faqat shu botga tegishli keshni o'qiymiz
         const cachedBotChats = localStorage.getItem(`squarix_bot_chats_${me.id}`);
         if (cachedBotChats) {
            const parsedIds = JSON.parse(cachedBotChats);
            const restoredChats = [];
            for (let id of parsedIds) {
                try {
                    const entity = await tgClient.getEntity(id);
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
                } catch (e) {}
            }
            setChats(restoredChats);
         } else { 
            // Agar yangi bot kiritilsa - TOZA OYNA!
            setChats([]); 
         }
      }
    } catch (error) { 
      localStorage.removeItem("squarix_session");
      window.location.reload(); 
    }
    setLoadingChats(false);
  };

  const sendCode = async () => {
    if (!phoneNumber) return;
    setIsLoading(true);
    try {
      const newClient = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 5 });
      await newClient.connect();
      const result = await newClient.sendCode({ apiId, apiHash }, phoneNumber);
      globalTgClient = newClient;
      setClient(newClient);
      setPhoneCodeHash(result.phoneCodeHash);
      setStep(2);
    } catch (error) { alert("Xatolik: Raqamni to'g'ri kiritganingizni tekshiring (+998...)"); }
    setIsLoading(false);
  };

  const verifyCode = async () => {
    if (!phoneCode || !client) return;
    setIsLoading(true);
    try {
      await client.signIn({ phoneNumber, phoneCodeHash, phoneCode });
      localStorage.setItem("squarix_session", client.session.save());
      setStep(4);
      fetchInitialData(client); 
    } catch (error) { 
      if (error.message && error.message.includes('SESSION_PASSWORD_NEEDED')) { setStep(3); } 
      else { alert("Kod xatosi: " + error.message); }
    }
    setIsLoading(false);
  };

  const verifyPassword = async () => {
    if (!password || !client) return;
    setIsLoading(true);
    try {
       await client.checkPassword(password);
       localStorage.setItem("squarix_session", client.session.save());
       setStep(4);
       fetchInitialData(client);
    } catch (error) { alert("Parol noto'g'ri!"); }
    setIsLoading(false);
  };

  const handleBotLogin = async () => {
    if (!botToken) return;
    setIsLoading(true);
    try {
      const newClient = new TelegramClient(new StringSession(""), apiId, apiHash, { connectionRetries: 5 });
      await newClient.start({ botAuthToken: botToken });
      globalTgClient = newClient;
      setClient(newClient);
      localStorage.setItem("squarix_session", newClient.session.save());
      setStep(4);
      fetchInitialData(newClient);
    } catch (error) { alert("Bot token xato yoki yaroqsiz!"); }
    setIsLoading(false);
  };

  const openChat = async (chat) => {
    if (!client) return;
    if (activeChat?.id !== chat.id) setMessages([]); 
    
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
      if (!isGhostModeRef.current && !currentUser?.bot) await client.invoke(new Api.messages.ReadHistory({ peer: chat.entity, maxId: 0 }));
    } catch (error) {}
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChat || !client) return;
    const textToSend = newMessage;
    setNewMessage('');
    setShowEmojiPicker(false);
    try {
      // Botlar faqat user orqali (id orqali yozishi uchun entity ni ishlatamiz)
      const sentMessage = await client.sendMessage(activeChat.entity, { message: textToSend, replyTo: replyingTo ? replyingTo.id : undefined });
      setReplyingTo(null); 
      setMessages(prev => [...prev, sentMessage]);
    } catch (error) { alert("Xabarni yuborib bo'lmadi! (Bot faqat unga yozganlargagina yoza oladi)"); }
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw', margin: '-8px', backgroundColor: '#e9ecef', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
        
        <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', width: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          
          <div style={{ width: '80px', height: '80px', backgroundColor: '#0088cc', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '15px', boxShadow: '0 5px 15px rgba(0, 136, 204, 0.4)' }}>
             <span style={{ color: 'white', fontSize: '35px', fontWeight: 'bold' }}>S</span>
          </div>
          
          <h1 style={{ margin: '0 0 5px 0', fontSize: '24px', color: '#333' }}>Squarix Web</h1>
          <p style={{ margin: '0 0 25px 0', fontSize: '14px', color: '#777', textAlign: 'center' }}>Telegram tizimiga ulanish</p>

          {step === 1 && (
            <>
              <div style={{ display: 'flex', width: '100%', backgroundColor: '#f0f2f5', borderRadius: '10px', padding: '4px', marginBottom: '20px' }}>
                 <button onClick={() => setLoginMode('user')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer', backgroundColor: loginMode === 'user' ? 'white' : 'transparent', color: loginMode === 'user' ? '#0088cc' : '#666', fontWeight: 'bold', transition: '0.3s', boxShadow: loginMode === 'user' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none' }}>Oddiy raqam</button>
                 <button onClick={() => setLoginMode('bot')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', cursor: 'pointer', backgroundColor: loginMode === 'bot' ? 'white' : 'transparent', color: loginMode === 'bot' ? '#28a745' : '#666', fontWeight: 'bold', transition: '0.3s', boxShadow: loginMode === 'bot' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none' }}>Bot Token</button>
              </div>

              {loginMode === 'user' ? (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                     <label style={{ fontSize: '13px', color: '#555', fontWeight: 'bold' }}>Telefon raqam</label>
                     <input type="text" placeholder="+998 90 123 45 67" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} style={{ padding: '14px', fontSize: '16px', color: '#333', borderRadius: '10px', border: '1px solid #ddd', outline: 'none', transition: 'border 0.3s' }} onFocus={(e) => e.target.style.borderColor = '#0088cc'} onBlur={(e) => e.target.style.borderColor = '#ddd'} />
                  </div>
                  <button onClick={sendCode} disabled={isLoading || !phoneNumber} style={{ padding: '14px', cursor: isLoading ? 'wait' : 'pointer', backgroundColor: isLoading ? '#ccc' : '#0088cc', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '16px', transition: '0.3s' }}>
                    {isLoading ? "Kuting..." : "Davom etish"}
                  </button>
                </div>
              ) : (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                     <label style={{ fontSize: '13px', color: '#555', fontWeight: 'bold' }}>BotFather Token</label>
                     <input type="text" placeholder="123456:ABC-DEF..." value={botToken} onChange={(e) => setBotToken(e.target.value)} style={{ padding: '14px', fontSize: '14px', color: '#333', borderRadius: '10px', border: '1px solid #ddd', outline: 'none', transition: 'border 0.3s' }} onFocus={(e) => e.target.style.borderColor = '#28a745'} onBlur={(e) => e.target.style.borderColor = '#ddd'} />
                  </div>
                  <button onClick={handleBotLogin} disabled={isLoading || !botToken} style={{ padding: '14px', cursor: isLoading ? 'wait' : 'pointer', backgroundColor: isLoading ? '#ccc' : '#28a745', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '16px', transition: '0.3s' }}>
                    {isLoading ? "Kuting..." : "Bot sifatida kirish"}
                  </button>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <p style={{ textAlign: 'center', fontSize: '14px', color: '#555', margin: 0 }}>Telegramdan kelgan kodni kiriting</p>
              <input type="text" placeholder="12345" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} style={{ padding: '14px', fontSize: '20px', letterSpacing: '5px', textAlign: 'center', color: '#333', borderRadius: '10px', border: '1px solid #0088cc', outline: 'none' }} />
              <button onClick={verifyCode} disabled={isLoading || !phoneCode} style={{ padding: '14px', cursor: isLoading ? 'wait' : 'pointer', backgroundColor: isLoading ? '#ccc' : '#0088cc', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '16px' }}>
                 {isLoading ? "Tekshirilmoqda..." : "Kirish"}
              </button>
              <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#0088cc', cursor: 'pointer', fontSize: '13px', marginTop: '5px' }}>Ortga qaytish</button>
            </div>
          )}

          {step === 3 && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <p style={{ textAlign: 'center', fontSize: '14px', color: '#555', margin: 0 }}>2-bosqichli parol (2FA) o'rnatilgan</p>
              <input type="password" placeholder="Parol..." value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '14px', fontSize: '16px', color: '#333', borderRadius: '10px', border: '1px solid #0088cc', outline: 'none' }} />
              <button onClick={verifyPassword} disabled={isLoading || !password} style={{ padding: '14px', cursor: isLoading ? 'wait' : 'pointer', backgroundColor: isLoading ? '#ccc' : '#0088cc', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '16px' }}>
                 {isLoading ? "Tekshirilmoqda..." : "Tasdiqlash"}
              </button>
            </div>
          )}

        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", margin: '-8px', backgroundColor: theme.bg, overflow: 'hidden' }}>
      
      {selectedMessage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setSelectedMessage(null)}>
          <div style={{ backgroundColor: theme.panelBg, padding: '20px', borderRadius: '15px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <h4 style={{ margin: '0 0 5px 0', color: theme.text, textAlign: 'center' }}>Amalni tanlang</h4>
            <button onClick={() => { setReplyingTo(selectedMessage); setSelectedMessage(null); }} style={{ padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#0088cc', color: 'white', fontSize: '15px', cursor: 'pointer', fontWeight: 'bold' }}>↪️ Javob berish (Reply)</button>
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
                  <div style={{ marginTop: '10px' }}>
                    <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: 'bold' }}>ID Raqam:</span>
                    <p style={{ margin: '5px 0 0', color: theme.text, fontSize: '14px' }}>{String(viewProfileData.id).replace('-100', '')}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHAP TOMON RO'YXAT (Chatlar va Sozlamalar) */}
      <div style={{ display: (isMobile && activeChat) ? 'none' : 'flex', width: isMobile ? '100%' : '320px', backgroundColor: theme.panelBg, borderRight: `1px solid ${theme.border}`, flexDirection: 'column' }}>
        {showProfileSettings ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: theme.bg, overflowY: 'auto' }}>
            <div style={{ padding: '15px 20px', backgroundColor: '#0088cc', color: 'white', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', zIndex: 10 }}>
              <button onClick={() => setShowProfileSettings(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer' }}>←</button>
              <h3 style={{ margin: 0 }}>Sozlamalar</h3>
            </div>
            
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: theme.panelBg, borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ position: 'relative', marginBottom: '15px' }}>
                {myPhotoUrl ? <img src={myPhotoUrl} alt="Profil" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #0088cc' }} /> : <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: '#0088cc', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '40px', fontWeight: 'bold' }}>{currentUser?.firstName?.charAt(0) || 'U'}</div>}
              </div>
              <h2 style={{ margin: '0 0 5px 0', fontSize: '20px', color: theme.text }}>{currentUser?.firstName} {currentUser?.lastName}</h2>
              <p style={{ margin: 0, color: '#28a745', fontWeight: 'bold', fontSize: '13px' }}>{currentUser?.bot ? "Bot Akkaunt" : "Shaxsiy Akkaunt"}</p>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>              
              <button onClick={handleLogout} style={{ width: '100%', padding: '14px', backgroundColor: '#dc3545', color: 'white', borderRadius: '10px', cursor: 'pointer', border: 'none', fontSize: '15px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', transition: '0.2s', boxShadow: '0 2px 5px rgba(220, 53, 69, 0.3)' }}>
                 Boshqa akkauntga kirish / Chiqish 🚪
              </button>
              <p style={{ fontSize: '12px', color: theme.textMuted, textAlign: 'center', margin: '-5px 0 0 0' }}>Boshqa raqam yoki bot token qo'shish uchun avval joriy akkauntdan chiqishingiz kerak.</p>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '10px 15px', backgroundColor: theme.panelBg, color: theme.text, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => setShowProfileSettings(true)}>
                {myPhotoUrl ? <img src={myPhotoUrl} alt="Me" style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#0088cc', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '18px' }}>{currentUser?.firstName?.charAt(0) || 'S'}</div>}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                   <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{currentUser?.firstName || 'Yuklanmoqda...'}</h3>
                   <span style={{ fontSize: '12px', color: currentUser?.bot ? '#28a745' : theme.textMuted, fontWeight: currentUser?.bot ? 'bold' : 'normal' }}>{currentUser?.bot ? "🤖 Bot Panel" : "Shaxsiy"}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {!currentUser?.bot && <button onClick={toggleGhostMode} title={isGhostMode ? "Ghost rejim yoniq" : "Ghost rejim o'chiq"} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '5px', opacity: isGhostMode ? 1 : 0.4, transition: '0.3s' }}>👻</button>}
                <button onClick={toggleThemeFunc} title="Tungi rejim" style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '5px' }}>{isDarkMode ? '☀️' : '🌙'}</button>
              </div>
            </div>

            <div style={{ display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${theme.border}`, backgroundColor: theme.panelBg }}>
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: '1', padding: '12px 5px', border: 'none', backgroundColor: 'transparent', color: activeTab === tab.id ? '#0088cc' : theme.textMuted, borderBottom: activeTab === tab.id ? '3px solid #0088cc' : '3px solid transparent', cursor: 'pointer', fontSize: '13px', fontWeight: activeTab === tab.id ? 'bold' : 'normal', transition: 'all 0.2s' }}>{tab.label}</button>
              ))}
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', backgroundColor: theme.panelBg }}>
              {loadingChats && <div style={{ padding: '20px', textAlign: 'center', color: theme.textMuted }}>Sinxronizatsiya... ⏳</div>}
              
              {chats.length === 0 && !loadingChats && currentUser?.bot && (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: theme.textMuted, fontSize: '14px', lineHeight: '1.5' }}>
                   <span style={{fontSize: '40px', display: 'block', marginBottom: '10px'}}>🤖</span>
                   Siz **Bot** panelidasiz. <br/><br/>
                   Hozircha suhbatlar yo'q. Kimdir botingizga yozishi bilan yoki avtomat kodingiz kimgadir javob berishi bilan u shu yerda paydo bo'ladi.
                </div>
              )}

              {filteredChats.map((chat, idx) => {
                let isListRead = false;
                const isListOut = chat.message?.out;
                if (isListOut && chat.dialog && chat.message?.id <= chat.dialog.readOutboxMaxId) isListRead = true;
                
                const unreadCount = chat.dialog?.unreadCount || 0;
                const isMsgDeleted = chat.message?.isDeleted;

                return (
                <div key={idx} onClick={() => openChat(chat)} style={{ padding: '12px 15px', borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', backgroundColor: activeChat?.id === chat.id ? theme.activeChat : 'transparent', display: 'flex', gap: '12px', alignItems: 'center', transition: 'background-color 0.2s' }}>
                  <LazyAvatar client={client} entity={chat.entity} size={52} fallbackText={chat.title} />
                  <div style={{ overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <h4 style={{ margin: 0, fontSize: '15px', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: unreadCount > 0 ? 'bold' : '600' }}>{chat.title}</h4>
                      {chat.message?.date && (
                        <span style={{ fontSize: '11px', color: unreadCount > 0 ? '#0088cc' : theme.textMuted, fontWeight: unreadCount > 0 ? 'bold' : 'normal' }}>{new Date(chat.message.date * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      {isListOut && !currentUser?.bot && <span style={{ color: isListRead ? '#34b7f1' : theme.textMuted, fontSize: '12px', fontWeight: 'bold' }}>{isListRead ? '✓✓' : '✓'}</span>}
                      
                      <p style={{ margin: 0, fontSize: '14px', color: isMsgDeleted ? '#dc3545' : theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                        {isMsgDeleted ? "🗑 O'chirilgan xabar" : (chat.message?.message || (chat.message?.media ? "[Media]" : "Xabar yo'q"))}
                      </p>
                      
                      {unreadCount > 0 && (
                        <div style={{ backgroundColor: '#28a745', color: 'white', borderRadius: '12px', padding: '2px 7px', fontSize: '11px', fontWeight: 'bold', marginLeft: 'auto', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
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
                <span style={{ fontSize: '12px', color: theme.textMuted }}>{activeChat.entity?.bot ? "Bot" : activeChat.isGroup ? "Guruh" : activeChat.isChannel ? "Kanal" : "Foydalanuvchi"}</span>
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
              {sendingMedia && <div style={{ alignSelf: 'flex-end', padding: '8px 15px', backgroundColor: theme.activeChat, borderRadius: '10px', color: theme.text, fontSize: '13px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>Jo'natilmoqda... ⏳</div>}
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
              <input type="text" placeholder="Xabar yozing..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }} style={{ flex: 1, padding: '14px 20px', borderRadius: '25px', border: `1px solid ${theme.border}`, outline: 'none', fontSize: '15px', color: theme.text, backgroundColor: theme.inputBg }} />
              <button onClick={sendMessage} disabled={!newMessage.trim()} style={{ padding: '12px 20px', borderRadius: '25px', border: 'none', backgroundColor: newMessage.trim() ? '#0088cc' : '#ccc', color: 'white', cursor: newMessage.trim() ? 'pointer' : 'default', fontWeight: 'bold', transition: '0.2s' }}>Yuborish</button>
            </div>
          </>
        ) : (
          <div style={{ margin: 'auto', backgroundColor: isDarkMode ? '#333' : 'rgba(0,0,0,0.05)', padding: '12px 25px', borderRadius: '20px', color: theme.textMuted, fontSize: '15px', fontWeight: 'bold', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>Suhbatni tanlang</div>
        )}
      </div>
    </div>
  );
}

export default App;