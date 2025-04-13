import { useState, useCallback, useEffect, memo } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { FiSun, FiMoon, FiCopy, FiHeart, FiEdit, FiSave, FiX } from 'react-icons/fi';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';

// Memoized TextContent component
const _TextContent = ({ text, isDarkMode, isEditing, onTextChange }) => (
  <div className="w-full">
    {isEditing ? (
      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        className={`w-full p-4 rounded-lg font-mono text-sm min-h-[200px] resize-y ${
          isDarkMode ? 'bg-gray-700/50 focus:bg-gray-700/70' : 'bg-gray-50 focus:bg-gray-100'
        } focus:outline-none transition-colors`}
      />
    ) : (
      <div
        className={`w-full p-4 rounded-lg font-mono text-sm whitespace-pre-wrap break-words ${
          isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'
        }`}
      >
        {text}
      </div>
    )}
  </div>
);

const TextContent = memo(_TextContent);
TextContent.displayName = 'TextContent';

export default function SharePage() {
  const router = useRouter();
  const { id } = router.query;
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [item, setItem] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch clipboard data
  const fetchClipboardItem = useCallback(async () => {
    if (!id) return;
    
    try {
      const response = await fetch(`/api/clipboard/${id}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setItem(data);
      setEditedText(data.text);
      setHasLiked(data.hasLiked || false);
      setLikesCount(data.likesCount || 0);
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load content');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Check system preference for dark mode
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    fetchClipboardItem();
  }, [fetchClipboardItem]);

  const toggleTheme = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(item?.text || '');
      toast.success('Copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy');
    }
  }, [item?.text]);

  const handleLike = useCallback(async () => {
    if (!id || isLiking) return;

    setIsLiking(true);
    try {
      const response = await fetch('/api/clipboard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'like' }),
      });

      if (!response.ok) throw new Error('Failed to update like');

      const data = await response.json();
      setHasLiked(data.hasLiked);
      setLikesCount(data.likesCount);
      toast.success(data.hasLiked ? 'Added to favorites!' : 'Removed from favorites');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update like');
    } finally {
      setIsLiking(false);
    }
  }, [id, isLiking]);

  const handleSave = async () => {
    if (!id || isSaving || !item.editable) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/clipboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, text: editedText }),
      });

      if (!response.ok) throw new Error('Failed to save');

      await fetchClipboardItem();
      setIsEditing(false);
      toast.success('Changes saved successfully!');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Error and loading states
  if (error) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center">
        <p className="text-lg font-bold text-red-500">{error}</p>
      </div>
    );
  }

  if (isLoading || !item) {
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
      } transition-colors duration-500`}
    >
      <Toaster position="top-right" />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`sticky top-0 z-50 w-full px-4 py-3 ${
          isDarkMode 
            ? 'bg-gray-900/80 border-gray-800' 
            : 'bg-white/80 border-gray-200'
        } backdrop-blur-xl border-b flex items-center justify-between`}
      >
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
  <Link href="/">
    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-colors duration-300">
      textide
    </span>
  </Link>
</h1>
        <motion.button
          whileHover={{ rotate: 180 }}
          onClick={toggleTheme}
          className={`p-2 rounded-full ${
            isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'
          } transition-colors`}
          aria-label="Toggle theme"
        >
          {isDarkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
        </motion.button>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-4xl mx-auto"
        >
          <div
            className={`p-6 rounded-xl ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            } shadow-lg`}
          >
            {/* Actions */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCopy}
                  className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                    isDarkMode
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <FiCopy size={16} />
                  <span>Copy</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleLike}
                  disabled={isLiking}
                  className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                    hasLiked
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : isDarkMode
                      ? 'bg-gray-700 hover:bg-gray-600'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <FiHeart
                    className={`${hasLiked ? 'fill-current' : ''} ${
                      isLiking ? 'animate-pulse' : ''
                    }`}
                  />
                  <span>{likesCount}</span>
                </motion.button>
                {item.editable && (
                  isEditing ? (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                          isDarkMode
                            ? 'bg-green-600 hover:bg-green-500'
                            : 'bg-green-500 hover:bg-green-400'
                        } text-white`}
                      >
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <FiSave size={16} />
                            <span>Save</span>
                          </>
                        )}
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setIsEditing(false);
                          setEditedText(item.text);
                        }}
                        className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                          isDarkMode
                            ? 'bg-gray-700 hover:bg-gray-600'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        <FiX size={16} />
                        <span>Cancel</span>
                      </motion.button>
                    </>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsEditing(true)}
                      className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                        isDarkMode
                          ? 'bg-blue-600 hover:bg-blue-500'
                          : 'bg-blue-500 hover:bg-blue-400'
                      } text-white`}
                    >
                      <FiEdit size={16} />
                      <span>Edit</span>
                    </motion.button>
                  )
                )}
              </div>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {new Date(item.createdAt).toLocaleDateString()}
              </div>
            </div>

            {/* Text Content */}
            <TextContent 
              text={isEditing ? editedText : item.text}
              isDarkMode={isDarkMode}
              isEditing={isEditing}
              onTextChange={setEditedText}
            />
          </div>
        </motion.div>

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
