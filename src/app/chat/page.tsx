"use client";

import { api, setAuthToken } from "@/api/api";
import useSocket from "@/hooks/useSocket";
import { Conversation } from "@/types/conversation";
import { Message } from "@/types/message";
import { User } from "@/types/user";
import {
	getToken,
	getUserIdFromToken,
	removeToken,
} from "@/utils/tokenStorage";
import { v4 } from "uuid";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";

export default function Home() {
	const token = getToken();
	const userId = getUserIdFromToken(token);
	const socket = useSocket(userId);

	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [conversation, setConversation] = useState<Conversation | null>(null);
	const [users, setUsers] = useState<User[]>([]);
	const [messages, setMessages] = useState<Message[]>([]);
	const [currentUser, setCurrentUser] = useState<User | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [selectedUser, setSelectedUser] = useState<User | null>(null);
	const [fetchedConversationMessages, setFetchedConversationMessages] =
		useState<string[]>([]);
	const [messageLoader, setMessageLoader] = useState<boolean>(false);
	const [selectedUserMessages, setSelectedUserMessages] = useState<Message[]>(
		[],
	);
	const [message, setMessage] = useState<string>("");
	const [searchTerm, setSearchTerm] = useState<string>("");
	const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

	const conversationRef = useRef(conversations);
	conversationRef.current = conversations;

	useEffect(() => {
		// Request permission if not granted
		if (Notification.permission === "default") {
			Notification.requestPermission();
		}
		const fetchData = async () => {
			if (!token) return;
			try {
				setLoading(true);
				setAuthToken(token);
				const conversationsResponse = await api.get(
					"/chat/conversations",
				);
				const usersResponse = await api.get("/users");
				const currentUserResponse = await api.get("/users/me");

				// remove users that are in conversations and currentuser
				const filterUsersResponse = usersResponse.data.filter(
					(user: User) =>
						!conversationsResponse.data.some(
							(conversation: Conversation) =>
								conversation.user.id === user.id,
						) && user.id !== currentUserResponse.data.id,
				);

				setConversations(conversationsResponse.data);
				setUsers(filterUsersResponse);
				setCurrentUser(currentUserResponse.data);
			} catch (error) {
				console.error(error);
			} finally {
				setLoading(false);
			}
		};
		fetchData();
	}, [token]);

	useEffect(() => {
		if (!token) return;
		const fetchMessages = async () => {
			if (!conversation) return;
			try {
				setMessageLoader(true);
				if (fetchedConversationMessages.includes(conversation.id))
					return;
				setAuthToken(token);
				const response = await api.get(
					`/chat/messages/${conversation?.id}`,
				);
				setMessages((prev) => {
					return prev.filter(
						(message) =>
							message.conversation.id !== conversation.id,
					);
				});
				setMessages((prev) => [...prev, ...response.data]);
				setFetchedConversationMessages((prev) => [
					...prev,
					conversation.id,
				]);
			} catch (error) {
				console.error(error);
			} finally {
				setMessageLoader(false);
			}
		};
		fetchMessages();
	}, [conversation, fetchedConversationMessages, token]);

	useEffect(() => {
		if (!conversation) {
			setSelectedUserMessages([]);
			return;
		}
		setSelectedUserMessages(
			messages
				.filter(
					(message) => message.conversation.id === conversation?.id,
				)
				.sort(),
		);
	}, [messages, conversation]);

	function selectUser(user: User) {
		// find conversion if found set it to selectedUser
		const conversation = conversations.find(
			(conversation) => conversation.user.id === user.id,
		);
		if (conversation) {
			setConversation(conversation);
		} else {
			setConversation(null);
		}
		setSelectedUser(user);
	}

	const sendMessage = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!message.trim() || !selectedUser || !currentUser || !socket) return;
		socket.emit("sendMessage", {
			message,
			senderId: currentUser.id,
			receiverId: selectedUser.id,
			createdAt: new Date().toISOString(),
		});
		const newMessage: Partial<Message> = {
			id: v4(),
			message,
			createdAt: new Date().toISOString(),
			sender: currentUser,
		};
		if (conversation) {
			const newConversation: Conversation = {
				id: conversation.id,
				user: conversation.user,
				lastMessageAt: new Date().toISOString(),
				lastMessage: message,
			};
			setConversation(newConversation);
			setConversations((prev) =>
				prev.map((conv) =>
					conv.id === conversation.id ? newConversation : conv,
				),
			);
			newMessage.conversation = newConversation;
		}
		if (!conversation) {
			const newConversation: Conversation = {
				id: v4(),
				user: selectedUser,
				lastMessageAt: new Date().toISOString(),
				lastMessage: message,
			};
			setConversation(newConversation);
			setFetchedConversationMessages((prev) => [
				...prev,
				newConversation.id,
			]);
			setConversations((prev) => [...prev, newConversation]);
			setUsers((prev) =>
				prev.filter((user) => user.id !== selectedUser.id),
			);
			newMessage.conversation = newConversation;
		}
		playSendNotificationSound();
		setMessages((prev) => [...prev, newMessage as Message]);
		setMessage("");
	};

	const [isTabActive, setIsTabActive] = useState(true);

	// Track window/tab focus
	useEffect(() => {
		const handleVisibilityChange = () => {
			setIsTabActive(!document.hidden);
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			document.removeEventListener(
				"visibilitychange",
				handleVisibilityChange,
			);
		};
	}, []);

	useEffect(() => {
		if (!socket) return;

		const messageHandler = (newMessage: Message) => {
			if (!newMessage.sender) return;
			playReceiveNotificationSound();
			const isConversationExist = conversationRef.current.find(
				(conversation) => conversation.user.id === newMessage.sender.id,
			);

			if (!isConversationExist) {
				setConversations((prev) => [
					...prev,
					{
						id: newMessage.conversation.id,
						user: newMessage.sender,
						lastMessageAt: newMessage.createdAt,
						lastMessage: newMessage.message,
					},
				]);
				setUsers((prev) =>
					prev.filter((user) => user.id !== newMessage.sender.id),
				);
				setMessages((prev) => [...prev, newMessage]);
			} else {
				setConversations((prev) =>
					prev.map((conversation) => {
						if (conversation.user.id === newMessage.sender.id) {
							return {
								...conversation,
								lastMessageAt: newMessage.createdAt,
								lastMessage: newMessage.message,
							};
						}
						return conversation;
					}),
				);

				const updatedMessage = {
					...newMessage,
					conversation: isConversationExist,
				};

				setMessages((prev) => [...prev, updatedMessage]);
			}

			// Push notification conditions
			if (!isTabActive || selectedUser?.id !== newMessage.sender.id) {
				sendNotification(newMessage);
			}
		};
		socket.on("receiveMessage", messageHandler);
		return () => {
			socket.off("receiveMessage", messageHandler);
		};
	}, [socket, isTabActive, selectedUser]);

	const playReceiveNotificationSound = () => {
		const audio = new Audio("/sounds/receive.mp3"); // path from public folder
		audio.play().catch((err) => {
			console.warn("Autoplay prevented:", err);
		});
	};
	const playSendNotificationSound = () => {
		const audio = new Audio("/sounds/send.mp3"); // path from public folder
		audio.play().catch((err) => {
			console.warn("Autoplay prevented:", err);
		});
	};

	const sendNotification = (message: Message) => {
		if (!("Notification" in window)) return;

		// Request permission if not granted
		if (Notification.permission === "default") {
			Notification.requestPermission();
		}

		if (Notification.permission === "granted") {
			new Notification(`New message from ${message.sender.name}`, {
				body: message.message,
				icon: message.sender.avatar || "/default-avatar.png",
			});
		}
	};

	const router = useRouter();
	const { setToast, showToast, getToast } = useToast();
	useEffect(() => {
		if (getToast() !== null) {
			showToast();
		}
	}, [showToast, getToast]);
	const handleLogout = () => {
		setShowLogoutConfirm(false);
		router.replace("/auth/login");
		setToast("Logout successful.");
		removeToken();
	};

	const filteredConversations = conversations.filter((c) =>
		c.user.name.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	const filteredUsers = users.filter((u) =>
		u.name.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	return loading ? (
		<div className="flex items-center justify-center h-screen bg-[#f3edf9]">
			<div className="w-16 h-16 border-4 border-gray-200 border-t-4 border-t-[#624185] rounded-full animate-spin"></div>
		</div>
	) : (
		<div className="h-screen w-full bg-[#dadbd3] flex items-center justify-center overflow-hidden">
			{/* Top Teal Bar (WhatsApp Style) */}
			<div className="absolute top-0 left-0 w-full h-[127px] bg-[#624185] z-0" />

			{/* Main Container */}
			<div className="relative z-10 w-full h-full md:h-[95vh] md:w-[95%] lg:w-[1396px] bg-[#f3edf9] shadow-2xl flex overflow-hidden">
				{/* Sidebar */}
				<aside className="w-[30%] min-w-[340px] max-w-[450px] bg-[#faf8fc] border-r border-[#e2d8ee] flex flex-col">
					{/* Sidebar Header */}
					<div className="h-[59px] bg-[#f3edf9] px-4 flex items-center justify-between">
						<div className="flex items-center">
							<Image
								src={
									currentUser?.avatar || "/default-avatar.png"
								}
								alt={currentUser?.name || "User"}
								width={40}
								height={40}
								className="rounded-full cursor-pointer hover:opacity-80 transition"
							/>
						</div>
						<div className="flex items-center space-x-6 text-[#624185]">
							{/* <button onClick={() => setToast('Coming soon')} title="Status" className="hover:bg-[#F2AD73] hover:text-white p-2 rounded-full transition">
                <svg viewBox="0 0 24 24" height="24" width="24" preserveAspectRatio="xMidYMid meet" className="" version="1.1" x="0px" y="0px" enableBackground="new 0 0 24 24"><path fill="currentColor" d="M12,20.664c-4.771,0-8.664-3.893-8.664-8.664S7.229,3.336,12,3.336S20.664,7.229,20.664,12 S16.771,20.664,12,20.664z M12,2c-5.523,0-10,4.477-10,10s4.477,10,10,10s10-4.477,10-10S17.523,2,12,2z M14.5,12 c0,1.381-1.119,2.5-2.5,2.5s-2.5-1.119-2.5-2.5s1.119-2.5,2.5-2.5S14.5,10.619,14.5,12z"></path></svg>
              </button>
              <button onClick={() => setToast('Coming soon')} title="New Chat" className="hover:bg-[#F2AD73] hover:text-white p-2 rounded-full transition">
                <svg viewBox="0 0 24 24" height="24" width="24" preserveAspectRatio="xMidYMid meet" className="" version="1.1" x="0px" y="0px" enableBackground="new 0 0 24 24"><path fill="currentColor" d="M19.005,3.175H4.174c-0.5,0-0.903,0.403-0.903,0.903V15.71c0,0.5,0.403,0.903,0.903,0.903h14.831 c0.5,0,0.903-0.403,0.903-0.903V4.078C19.908,3.578,19.505,3.175,19.005,3.175z M18.102,14.807H5.076V4.981h13.026V14.807z M15.783,18.062H8.222c-0.342,0-0.655,0.191-0.814,0.494l-1.428,2.72c-0.129,0.246-0.034,0.548,0.212,0.677 c0.076,0.04,0.161,0.06,0.245,0.06c0.176,0,0.348-0.089,0.448-0.249l1.107-2.109h7.456l1.107,2.109 c0.161,0.307,0.541,0.428,0.849,0.267s0.428-0.541,0.267-0.849l-1.428-2.72C16.438,18.253,16.126,18.062,15.783,18.062z"></path></svg>
              </button> */}
							<button
								onClick={() => setShowLogoutConfirm(true)}
								title="Logout"
								className="hover:bg-[#F2AD73] hover:text-white p-2 rounded-full transition"
							>
								<svg
									viewBox="0 0 24 24"
									height="24"
									width="24"
									preserveAspectRatio="xMidYMid meet"
									className=""
									version="1.1"
									x="0px"
									y="0px"
									enableBackground="new 0 0 24 24"
								>
									<path
										fill="currentColor"
										d="M12,7c1.104,0,2-0.896,2-2c0-1.104-0.896-2-2-2c-1.104,0-2,0.896-2,2C10,6.104,10.896,7,12,7z M12,9c-1.104,0-2,0.896-2,2 c0,1.104,0.896,2,2,2c1.104,0,2-0.896,2-2C14,9.896,13.104,9,12,9z M12,15c-1.104,0-2,0.896-2,2c0,1.104,0.896,2,2,2 c1.104,0,2-0.896,2-2C14,15.896,13.104,15,12,15z"
									></path>
								</svg>
							</button>
						</div>
					</div>

					{/* Search Box */}
					<div className="bg-[#faf8fc] px-3 py-2 border-b border-[#e2d8ee]">
						<div className="bg-[#f3edf9] rounded-lg flex items-center px-4 py-1.5 focus-within:bg-[#faf8fc] focus-within:shadow-sm">
							<svg
								viewBox="0 0 24 24"
								height="18"
								width="18"
								preserveAspectRatio="xMidYMid meet"
								className="text-[#624185] mr-4"
								version="1.1"
								x="0px"
								y="0px"
								enableBackground="new 0 0 24 24"
							>
								<path
									fill="currentColor"
									d="M15.009,13.805h-0.636l-0.22-0.219c0.789-0.914,1.264-2.103,1.264-3.395c0-2.969-2.405-5.374-5.374-5.374 s-5.374,2.405-5.374,5.374s2.405,5.374,5.374,5.374c1.291,0,2.481-0.474,3.395-1.264l0.219,0.22v0.636l4.045,4.037l1.204-1.204 L15.009,13.805z M10.044,13.805c-2.078,0-3.76-1.682-3.76-3.76s1.682-3.76,3.76-3.76s3.76,1.682,3.76,3.76S12.122,13.805,10.044,13.805z"
								></path>
							</svg>
							<input
								type="text"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								placeholder="Search or start new chat"
								className="bg-transparent border-none outline-none text-sm w-full py-1 text-[#54656f]"
							/>
						</div>
					</div>

					{/* Chat List */}
					<div className="flex-1 overflow-y-auto chat-scrollbar">
						{/* Conversations */}
						{[...filteredConversations]
							.sort(
								(a, b) =>
									new Date(b.lastMessageAt).getTime() -
									new Date(a.lastMessageAt).getTime(),
							)
							.map((conversation) => (
								<div
									key={conversation.id}
									onClick={() =>
										selectUser(conversation.user)
									}
									className={`flex items-center px-4 py-3 cursor-pointer hover:bg-[#f3edf9] border-b border-[#e2d8ee] transition ${
										selectedUser?.id ===
										conversation.user.id
											? "bg-[#F2AD73]/20"
											: ""
									}`}
								>
									<div className="flex-shrink-0 mr-3">
										<Image
											src={
												conversation.user.avatar ||
												"/default-avatar.png"
											}
											alt={conversation.user.name}
											width={48}
											height={48}
											className="rounded-full h-12 w-12 object-cover"
										/>
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex justify-between items-center mb-0.5">
											<h2 className="text-[#624185] font-semibold text-[17px] truncate hover:text-clip">
												{conversation.user.name}
											</h2>
											<span className="text-[#F2AD73] text-[12px]">
												{new Date(
													conversation.lastMessageAt,
												).toLocaleDateString() ===
												new Date().toLocaleDateString()
													? new Date(
															conversation.lastMessageAt,
														).toLocaleTimeString(
															[],
															{
																hour: "2-digit",
																minute: "2-digit",
															},
														)
													: new Date(
															conversation.lastMessageAt,
														).toLocaleDateString()}
											</span>
										</div>
										<div className="flex items-center text-[#667781] text-[14px]">
											<span className="truncate">
												{conversation.lastMessage}
											</span>
										</div>
									</div>
								</div>
							))}

						{/* Other Users */}
						{filteredUsers.length > 0 && (
							<div className="px-4 py-2 text-[#624185] text-xs font-semibold uppercase tracking-wider bg-[#faf8fc]">
								Other Users
							</div>
						)}
						{filteredUsers.map((user) => (
							<div
								key={user.id}
								onClick={() => selectUser(user)}
								className={`flex items-center px-4 py-3 cursor-pointer hover:bg-[#f3edf9] border-b border-[#e2d8ee] transition ${
									selectedUser?.id === user.id
										? "bg-[#F2AD73]/20"
										: ""
								}`}
							>
								<div className="flex-shrink-0 mr-3">
									<Image
										src={
											user.avatar || "/default-avatar.png"
										}
										alt={user.name}
										width={48}
										height={48}
										className="rounded-full h-12 w-12 object-cover"
									/>
								</div>
								<div className="flex-1 min-w-0">
									<h2 className="text-[#624185] font-semibold text-[17px]">
										{user.name}
									</h2>
									<span className="text-[#F2AD73] text-[12px]">
										Start a conversation
									</span>
								</div>
							</div>
						))}
					</div>
				</aside>

				{/* Main Chat Area */}
				<main className="flex-1 flex flex-col relative bg-[#fdfcff] overflow-hidden">
					{selectedUser ? (
						<>
							{/* Chat Pattern Overlay */}
							<div className="absolute inset-0 z-0 pointer-events-none custom-chat-bg" />

							{/* Chat Header */}
							<header className="h-[59px] bg-[#f3edf9] px-4 flex items-center justify-between z-10 border-l border-[#e2d8ee]">
								<div className="flex items-center flex-1">
									<Image
										src={
											selectedUser.avatar ||
											"/default-avatar.png"
										}
										alt={selectedUser.name}
										width={40}
										height={40}
										className="rounded-full cursor-pointer h-10 w-10 object-cover"
									/>
									<div className="ml-3 flex flex-col">
										<span className="text-[#624185] font-semibold leading-tight">
											{selectedUser.name}
										</span>
										<span className="text-[#F2AD73] text-[13px] leading-tight">
											online
										</span>
									</div>
								</div>
								<div className="flex items-center space-x-5 text-[#624185]">
									<button
										title="Coming soon"
										className="hover:bg-[#F2AD73] hover:text-white p-2 rounded-full transition"
									>
										<svg
											viewBox="0 0 24 24"
											height="24"
											width="24"
											preserveAspectRatio="xMidYMid meet"
											className=""
											version="1.1"
											x="0px"
											y="0px"
											enableBackground="new 0 0 24 24"
										>
											<path
												fill="currentColor"
												d="M15.009,13.805h-0.636l-0.22-0.219c0.789-0.914,1.264-2.103,1.264-3.395c0-2.969-2.405-5.374-5.374-5.374 s-5.374,2.405-5.374,5.374s2.405,5.374,5.374,5.374c1.291,0,2.481-0.474,3.395-1.264l0.219,0.22v0.636l4.045,4.037l1.204-1.204 L15.009,13.805z M10.044,13.805c-2.078,0-3.76-1.682-3.76-3.76s1.682-3.76,3.76-3.76s3.76,1.682,3.76,3.76S12.122,13.805,10.044,13.805z"
											></path>
										</svg>
									</button>
									<button
										title="Coming soon"
										className="hover:bg-[#F2AD73] hover:text-white p-2 rounded-full transition"
									>
										<svg
											viewBox="0 0 24 24"
											height="24"
											width="24"
											preserveAspectRatio="xMidYMid meet"
											className=""
											version="1.1"
											x="0px"
											y="0px"
											enableBackground="new 0 0 24 24"
										>
											<path
												fill="currentColor"
												d="M1.816,15.556v0.002c0,1.502,0.584,2.912,1.646,3.972s2.47,1.647,3.972,1.647c1.502,0,2.912-0.584,3.972-1.645 l9.547-9.548c0.769-0.768,1.147-1.767,1.058-2.817c-0.079-0.968-0.548-1.927-1.319-2.698c-1.594-1.592-4.068-1.56-5.503,0.044 l-9.5,9.501c-0.51,0.511-0.692,1.246-0.48,1.903c0.213,0.66,0.767,1.151,1.442,1.263c1.026,0.171,2.052-0.297,2.695-0.941 l6.643-6.645c0.39-0.391,0.39-1.023,0-1.414s-1.023-0.391-1.414,0l-6.643,6.645c-0.385,0.385-1,0.385-1.385,0 c-0.183-0.183-0.283-0.428-0.283-0.686c0-0.264,0.106-0.505,0.294-0.693l9.5-9.501c0.781-0.781,2.152-0.781,2.933,0 c0.781,0.781,0.781,2.152,0,2.933l-9.548,9.547c-1.339,1.339-3.518,1.339-4.857,0c-1.339-1.339-1.339-3.518,0-4.857l9.547-9.548 c0.391-0.391,0.391-1.024,0-1.414c-0.39-0.391-1.023-0.391-1.414,0l-9.547,9.548C1.815,11.23,1.325,12.338,1.325,13.439 C1.325,14.214,1.491,14.93,1.816,15.556z"
											></path>
										</svg>
									</button>
									<button
										title="Coming soon"
										className="hover:bg-[#F2AD73] hover:text-white p-2 rounded-full transition"
									>
										<svg
											viewBox="0 0 24 24"
											height="24"
											width="24"
											preserveAspectRatio="xMidYMid meet"
											className=""
											version="1.1"
											x="0px"
											y="0px"
											enableBackground="new 0 0 24 24"
										>
											<path
												fill="currentColor"
												d="M12,7c1.104,0,2-0.896,2-2c0-1.104-0.896-2-2-2c-1.104,0-2,0.896-2,2C10,6.104,10.896,7,12,7z M12,9c-1.104,0-2,0.896-2,2 c0,1.104,0.896,2,2,2c1.104,0,2-0.896,2-2C14,9.896,13.104,9,12,9z M12,15c-1.104,0-2,0.896-2,2c0,1.104,0.896,2,2,2 c1.104,0,2-0.896,2-2C14,15.896,13.104,15,12,15z"
											></path>
										</svg>
									</button>
								</div>
							</header>

							{/* Messages Content */}
							<div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-2 z-10 flex flex-col-reverse chat-scrollbar custom-chat-bg">
								{messageLoader ? (
									<div className="flex justify-center items-center h-full">
										<div className="w-8 h-8 border-4 border-[#624185] border-t-transparent rounded-full animate-spin"></div>
									</div>
								) : (
									<div className="flex flex-col space-y-1">
										{selectedUserMessages.map((msg) => {
											const isMe =
												msg.sender.id ===
												currentUser?.id;
											return (
												<div
													key={msg.id}
													className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
												>
													<div
														className={`relative max-w-[85%] md:max-w-[65%] px-2.5 py-1.5 rounded-lg shadow-sm text-[14.2px] leading-tight ${
															isMe
																? "bg-[#F2AD73] text-[#111b21] rounded-tr-none"
																: "bg-[#faf8fc] text-[#111b21] rounded-tl-none"
														}`}
													>
														<div className="mr-4 break-words">
															{msg.message}
														</div>
														<div className="text-[11px] text-[#667781] text-right mt-1 flex items-center justify-end">
															{new Date(
																msg.createdAt,
															).toLocaleTimeString(
																[],
																{
																	hour: "2-digit",
																	minute: "2-digit",
																},
															)}
															{isMe && (
																<span className="ml-1 text-[#53bdeb]">
																	<svg
																		viewBox="0 0 16 11"
																		height="11"
																		width="16"
																		preserveAspectRatio="xMidYMid meet"
																		className=""
																		version="1.1"
																		x="0px"
																		y="0px"
																		enableBackground="new 0 0 16 11"
																	>
																		<path
																			fill="currentColor"
																			d="M15.01,3.316l-0.478-0.372c-0.276-0.211-0.671-0.161-0.882,0.115L9.589,8.514L6.966,6.38C6.69,6.155,6.279,6.185,6.04,6.446 L5.782,6.729c-0.239,0.261-0.21,0.672,0.065,0.897l3.23,2.62c0.276,0.224,0.686,0.184,0.913-0.091l4.137-5.041 C15.34,4.839,15.286,4.426,15.01,3.316z M10.202,3.316l-0.478-0.372c-0.276-0.211-0.671-0.161-0.882,0.115l-4.06,4.937l-2.624-2.134 c-0.276-0.224-0.687-0.184-0.913,0.091L0.985,6.239c-0.239,0.261-0.21,0.672,0.065,0.897l3.23,2.62 c0.276,0.224,0.686,0.184,0.913-0.091l4.137-5.041C10.532,4.839,10.479,4.426,10.202,3.316z"
																		></path>
																	</svg>
																</span>
															)}
														</div>
													</div>
												</div>
											);
										})}
									</div>
								)}
							</div>

							{/* Input Area */}
							<footer className="bg-[#f3edf9] px-4 py-2 flex items-center space-x-4 z-10">
								<button
									type="button"
									title="Coming soon"
									className="text-[#624185] hover:bg-[#F2AD73] hover:text-white p-2 rounded-full transition"
								>
									<svg
										viewBox="0 0 24 24"
										height="24"
										width="24"
										preserveAspectRatio="xMidYMid meet"
										className=""
										version="1.1"
										x="0px"
										y="0px"
										enableBackground="new 0 0 24 24"
									>
										<path
											fill="currentColor"
											d="M12,2h-0.01c-5.52,0-10,4.48-10,10s4.48,10,10,10h0.01c5.52,0,10-4.48,10-10S17.51,2,12,2z M12,20.5 c-4.69,0-8.5-3.81-8.5-8.5s3.81-8.5,8.5-8.5h0.01c4.69,0,8.5,3.81,8.5,8.5S16.69,20.5,12,20.5z M10.82,10.51 c0.33,0,0.6,0.27,0.6,0.6v1.4c0,0.33-0.27,0.6-0.6,0.6s-0.6-0.27-0.6-0.6v-1.4C10.22,10.78,10.49,10.51,10.82,10.51z M13.18,10.51 c0.33,0,0.6,0.27,0.6,0.6v1.4c0,0.33-0.27,0.6-0.6,0.6s-0.6-0.27-0.6-0.6v-1.4C12.58,10.78,12.85,10.51,13.18,10.51z M12,17.5 c2.04,0,3.85-1.12,4.8-2.8c0.16-0.28,0.07-0.64-0.21-0.8c-0.28-0.16-0.64-0.07-0.8,0.21c-0.78,1.36-2.22,2.27-3.79,2.27 s-3.01-0.91-3.79-2.27c-0.16-0.28-0.52-0.37-0.8-0.21c-0.28,0.16-0.37,0.52-0.21,0.8C8,16.38,9.96,17.5,12,17.5z"
										></path>
									</svg>
								</button>
								<button
									type="button"
									title="Coming soon"
									className="text-[#624185] hover:bg-[#F2AD73] hover:text-white p-2 rounded-full transition"
								>
									<svg
										viewBox="0 0 24 24"
										height="24"
										width="24"
										preserveAspectRatio="xMidYMid meet"
										className=""
										version="1.1"
										x="0px"
										y="0px"
										enableBackground="new 0 0 24 24"
									>
										<path
											fill="currentColor"
											d="M11.99,2C6.47,2,2,6.48,2,12s4.47,10,9.99,10C17.52,22,22,17.52,22,12S17.52,2,11.99,2z M12,20 c-4.42,0-8-3.58-8-8s3.58-8,8-8s8,3.58,8,8S16.42,20,12,20z M11,11V7h2v4h4v2h-4v4h-2v-4H7v-2H11z"
										></path>
									</svg>
								</button>
								<form
									className="flex-1 flex items-center bg-[#faf8fc] rounded-lg px-3 py-1.5"
									onSubmit={sendMessage}
								>
									<input
										type="text"
										placeholder="Type a message"
										className="w-full bg-transparent border-none outline-none text-[15px] py-1 text-[#111b21]"
										value={message}
										onChange={(e) =>
											setMessage(e.target.value)
										}
									/>
									<button type="submit" className="hidden" />
								</form>
								<button
									type="button"
									title="Coming soon"
									className="text-[#624185] hover:bg-[#F2AD73] hover:text-white p-2 rounded-full transition"
								>
									<svg
										viewBox="0 0 24 24"
										height="24"
										width="24"
										preserveAspectRatio="xMidYMid meet"
										className=""
										version="1.1"
										x="0px"
										y="0px"
										enableBackground="new 0 0 24 24"
									>
										<path
											fill="currentColor"
											d="M11.99,2C6.47,2,2,6.48,2,12s4.47,10,9.99,10C17.52,22,22,17.52,22,12S17.52,2,11.99,2z M12,20 c-4.42,0-8-3.58-8-8s3.58-8,8-8s8,3.58,8,8S16.42,20,12,20z M11,11V7h2v4h4v2h-4v4h-2v-4H7v-2H11z"
										></path>
									</svg>
								</button>
							</footer>
						</>
					) : (
						<div className="flex-1 flex flex-col items-center justify-center bg-[#faf8fc] border-b-[6px] border-[#624185]">
							<div className="flex flex-col items-center max-w-md text-center">
								<div className="w-44 h-44 relative mb-8 flex items-center justify-center rounded-full bg-[#f4f0fa] shadow-sm border border-[#e2d8ee]">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="84"
										height="84"
										viewBox="0 0 24 24"
										fill="none"
										stroke="#624185"
										strokeWidth="1.2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
										<path d="M8 10h.01"></path>
										<path d="M12 10h.01"></path>
										<path d="M16 10h.01"></path>
									</svg>
								</div>
								<h1 className="text-[32px] font-thin text-[#41525d] mb-4">
									Chat Web
								</h1>
								<p className="text-[#667781] text-[14px] leading-relaxed">
									Send and receive messages without keeping
									your phone online.
									<br />
									Use WhatsApp on up to 4 linked devices and 1
									phone at the same time.
								</p>
								<div className="mt-auto pt-20 flex items-center text-[#8696a0] text-[14px]">
									<svg
										viewBox="0 0 24 24"
										height="14"
										width="14"
										preserveAspectRatio="xMidYMid meet"
										className="mr-1.5"
										version="1.1"
										x="0px"
										y="0px"
										enableBackground="new 0 0 24 24"
									>
										<path
											fill="currentColor"
											d="M12.8,3.3c-0.5-0.1-1.1,0.2-1.2,0.7l-1,3.4l-1.4-0.1c-0.2,0-0.4,0-0.6,0.1c-0.5,0.1-0.9,0.5-1,1.1l-0.3,1.6l-1.6,0.3 c-0.6,0.1-1,0.5-1.1,1.1c0,0.2,0,0.4,0.1,0.6l1.2,3.3l-0.7,1.2c-0.3,0.5-0.1,1,0.3,1.3l2.8,1.7c0.5,0.3,1,0.1,1.3-0.3l0.7-1.2l3.4-0.9 c0.6-0.2,0.9-0.8,0.7-1.3c0-0.1-0.1-0.2-0.2-0.3l-2.4-1.8l0.9-3.4c0.1-0.6-0.2-1.1-0.7-1.2c-0.1,0-0.2,0-0.3,0l-1.6,0.1l0.3-1.6 c0.1-0.5-0.2-1.1-0.7-1.2C13.1,3.2,13,3.2,12.8,3.3z"
										></path>
									</svg>
									End-to-end encrypted
								</div>
							</div>
						</div>
					)}
				</main>
			</div>

			<style jsx global>{`
				.chat-scrollbar::-webkit-scrollbar {
					width: 6px;
				}
				.chat-scrollbar::-webkit-scrollbar-track {
					background: transparent;
				}
				.chat-scrollbar::-webkit-scrollbar-thumb {
					background: #ced0d1;
				}
				.custom-chat-bg {
					background-color: ##e6e1e1;
					background-image:
						radial-gradient(
							rgba(98, 65, 133, 0.08) 1.5px,
							transparent 1.5px
						),
						radial-gradient(
							rgba(98, 65, 133, 0.08) 1.5px,
							transparent 1.5px
						);
					background-size: 30px 30px;
					background-position:
						0 0,
						15px 15px;
				}
			`}</style>
			{/* Logout Confirmation Modal */}
			{showLogoutConfirm && (
				<div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
					<div className="bg-[#faf8fc] rounded-2xl shadow-2xl p-6 w-full max-w-[340px] text-center transform transition-all">
						<div className="w-16 h-16 bg-red-100 rounded-full mx-auto flex items-center justify-center mb-5">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-8 w-8 text-red-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
								/>
							</svg>
						</div>
						<h3 className="text-xl font-bold text-[#624185] mb-2">
							Sign Out
						</h3>
						<p className="text-[#54656f] mb-6 text-sm">
							Are you sure you want to log out of Secure Chat? You
							will need to sign in again to access your messages.
						</p>
						<div className="flex space-x-3">
							<button
								onClick={() => setShowLogoutConfirm(false)}
								className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
							>
								Cancel
							</button>
							<button
								onClick={handleLogout}
								className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition shadow-md"
							>
								Logout
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
