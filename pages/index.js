import { useState, useCallback, useRef, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSun, FiMoon, FiCopy, FiHeart, FiShare2, FiExternalLink, FiX } from 'react-icons/fi';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

// Memoized ClipboardItem component
const ClipboardItem = memo(({ item, isDarkMode, onOpen }) => {
  const [isLiking, setIsLiking] = useState(false);

  // Function to truncate text
  const truncateText = (text, maxLength = 100) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '...';
  };

  const handleLike = async (e) => {
    e.stopPropagation();
    if (isLiking) return;

    setIsLiking(true);
    try {
      const response = await fetch(`/api/clipboard`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, action: 'like' }),
      });

      if (!response.ok) throw new Error('Failed to like');
      
      // Notify parent to refresh data
      onOpen(true);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update like');
    } finally {
      setIsLiking(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ scale: 1.02 }}
      onClick={() => onOpen()}
      className={`p-4 rounded-xl cursor-pointer ${
        isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'
      } shadow-lg transition-colors`}
    >
      <p className="mb-3 font-mono text-sm line-clamp-2 break-all">
        {truncateText(item.text)}
      </p>
      <div className="flex items-center justify-between text-sm">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleLike}
          disabled={isLiking}
          className={`flex items-center gap-1.5 ${
            item.hasLiked ? 'text-red-500' : isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}
        >
          <FiHeart
            className={`${item.hasLiked ? 'fill-current' : ''} ${
              isLiking ? 'animate-pulse' : ''
            }`}
          />
          <span>{item.likesCount || 0}</span>
        </motion.button>
        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      </div>
    </motion.div>
  );
});

// Memoized HistoryList component
const HistoryList = memo(({ items = [], onItemClick, isDarkMode }) => {
  // Get top 3 most liked items
  const topItems = items
    .sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
    .slice(0, 3);

  if (!topItems.length) return null;

  return (
    <div className={`p-4 rounded-xl ${
      isDarkMode ? 'bg-gray-800' : 'bg-white'
    } shadow-lg`}>
      <h2 className={`text-lg font-semibold mb-4 ${
        isDarkMode ? 'text-gray-200' : 'text-gray-800'
      }`}>
        Top 3 Most Liked
      </h2>
      <div className="space-y-3">
        <AnimatePresence>
          {topItems.map(item => (
            <ClipboardItem
              key={item.id}
              item={item}
              isDarkMode={isDarkMode}
              onOpen={(refresh) => onItemClick(item, refresh)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
});

// Main component
export default function Home() {
  const [text, setText] = useState('');
  const [isEditable, setIsEditable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [clipboards, setClipboards] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [lastSavedItem, setLastSavedItem] = useState(null);
  const textareaRef = useRef(null);

  // Fetch clipboard data
  const fetchClipboards = useCallback(async () => {
    try {
      const response = await fetch('/api/clipboard');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setClipboards(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load data');
    }
  }, []);

  useEffect(() => {
    // Check system preference for dark mode
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
    // Initial fetch
    fetchClipboards();
  }, [fetchClipboards]);

  const handleTextChange = useCallback((e) => {
    setText(e.target.value);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/clipboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text,
          editable: isEditable 
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      setText('');
      
      // Add new item to the list
      setClipboards(prev => [data, ...(prev || [])]);

      // Set last saved item for success actions
      setLastSavedItem({
        id: data.id,
        shareLink: `${window.location.origin}/share/${data.id}`
      });

      toast.success('Saved successfully!');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to save');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!lastSavedItem) return;
    try {
      await navigator.clipboard.writeText(lastSavedItem.shareLink);
      toast.success('Share link copied!');
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleOpen = () => {
    if (!lastSavedItem) return;
    window.open(lastSavedItem.shareLink, '_blank');
  };

  const handleHistoryClick = useCallback((item, refresh = false) => {
    if (refresh) {
      fetchClipboards();
      return;
    }
    window.open(`/share/${item.id}`, '_blank');
  }, [fetchClipboards]);

  const toggleTheme = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  // Loading state
  if (!clipboards) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-gray-900">
        <p className="text-lg font-bold text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col ${
        isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
      } transition-colors duration-500 dark:bg-gray-900`}
    >
      <Toaster position="top-right" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-50 w-full px-4 py-3 backdrop-blur-lg bg-opacity-90 border-b flex items-center justify-between"
      >
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
          <Link href="/">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-colors duration-300">
              TextTide
            </span>
          </Link>
        </h1>
        <motion.button
          whileHover={{ rotate: 180 }}
          onClick={toggleTheme}
          className={`p-2 rounded-full ${
            isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
          } hover:bg-opacity-80`}
          aria-label="Toggle theme"
        >
          {isDarkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
        </motion.button>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Text Area - Takes up 2/3 of space */}
          <div className="lg:col-span-2">
            <div
              className={`p-4 rounded-xl ${
                isDarkMode ? 'bg-gray-800' : 'bg-white'
              } shadow-lg`}
            >
              <div className="flex items-center justify-between mb-4">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsEditable(!isEditable)}
                  className={`group flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isDarkMode 
                      ? 'hover:bg-gray-700/50' 
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="relative">
                    <div
                      className={`w-10 h-6 rounded-full transition-colors ${
                        isEditable
                          ? 'bg-blue-500'
                          : isDarkMode
                          ? 'bg-gray-600'
                          : 'bg-gray-300'
                      }`}
                    />
                    <div
                      className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform transform ${
                        isEditable ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                  <span className={`text-sm ${
                    isEditable 
                      ? isDarkMode ? 'text-blue-400' : 'text-blue-600'
                      : isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  } group-hover:text-opacity-75 transition-colors`}>
                    Allow Editing
                  </span>
                </motion.button>
              </div>

              <motion.form onSubmit={handleSubmit} className="w-full">
                <div className="mb-4">
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleTextChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        handleSubmit(e);
                      }
                    }}
                    placeholder="Type or paste your text here..."
                    className={`w-full p-4 rounded-lg font-mono text-sm min-h-[200px] resize-y ${
                      isDarkMode
                        ? 'bg-gray-700/50 focus:bg-gray-700/70'
                        : 'bg-gray-50 focus:bg-gray-100'
                    } focus:outline-none transition-colors`}
                  />
                </div>
                <div className="flex justify-end">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    disabled={isLoading}
                    className={`px-6 py-2 rounded-lg font-medium text-white ${
                      isLoading
                        ? 'bg-gray-500 cursor-not-allowed'
                        : isDarkMode
                        ? 'bg-blue-600 hover:bg-blue-500'
                        : 'bg-blue-500 hover:bg-blue-400'
                    } transition-colors flex items-center gap-2`}
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      'Save'
                    )}
                  </motion.button>
                </div>
              </motion.form>
            </div>

            {/* Success Actions */}
            {lastSavedItem && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className={`mt-4 p-4 rounded-xl ${
                  isDarkMode ? 'bg-gray-800' : 'bg-white'
                } shadow-lg relative`}
              >
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setLastSavedItem(null)}
                  className={`absolute top-3 right-3 p-1 rounded-full ${
                    isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                  }`}
                >
                  <FiX size={16} />
                </motion.button>
                <div className="flex items-center justify-between gap-4 pr-8">
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Text saved! What would you like to do?
                  </div>
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleCopyLink}
                      className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                        isDarkMode
                          ? 'bg-gray-700 hover:bg-gray-600 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                      }`}
                    >
                      <FiCopy size={16} />
                      <span>Copy Link</span>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleOpen}
                      className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                        isDarkMode
                          ? 'bg-blue-600 hover:bg-blue-500'
                          : 'bg-blue-500 hover:bg-blue-400'
                      } text-white`}
                    >
                      <FiExternalLink size={16} />
                      <span>Open</span>
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* History List - Takes up 1/3 of space */}
          <div className="lg:col-span-1">
            {clipboards && (
              <HistoryList
                items={clipboards}
                onItemClick={handleHistoryClick}
                isDarkMode={isDarkMode}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pb-4 text-center">
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Created with{' '}
            <span className="text-red-500 animate-pulse">❤</span>
            {' '}by{' '}
            <a
              href="https://alexsirait.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className={`font-medium hover:underline ${
                isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'
              }`}
            >
              Alex Sirait
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}