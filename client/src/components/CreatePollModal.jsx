import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";

const CreatePollModal = ({ isOpen, onClose, onSubmit }) => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multipleAnswers, setMultipleAnswers] = useState(false);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validOptions = options.filter(opt => opt.trim().length > 0).map(opt => ({ text: opt.trim(), votes: [] }));
    
    if (question.trim().length === 0 || validOptions.length < 2) {
      return;
    }

    onSubmit({
      question: question.trim(),
      options: validOptions,
      multipleAnswers
    });

    // Reset
    setQuestion("");
    setOptions(["", ""]);
    setMultipleAnswers(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--modal-backdrop)] backdrop-blur-md animate-fadeIn">
      <div className="fixed inset-0" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-white dark:bg-[#121118] border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh] animate-scaleIn">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Create Poll</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Question</label>
            <input
              type="text"
              placeholder="Ask a question..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
              autoFocus
            />
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Options</label>
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Option ${index + 1}`}
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  className="flex-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-400 transition-colors"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    className="p-2.5 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            
            {options.length < 10 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors mt-2"
              >
                <Plus size={16} />
                <span>Add Option</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between py-2 border-t border-black/5 dark:border-white/5">
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Allow multiple answers</span>
            <button
              type="button"
              onClick={() => setMultipleAnswers(!multipleAnswers)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                multipleAnswers ? "bg-zinc-900 dark:bg-white" : "bg-zinc-300 dark:bg-zinc-700"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-[#121118] shadow-sm ring-0 transition duration-200 ease-in-out ${
                  multipleAnswers ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <button
            type="submit"
            disabled={question.trim().length === 0 || options.filter(opt => opt.trim().length > 0).length < 2}
            className="w-full py-3.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-bold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors"
          >
            Send Poll
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreatePollModal;
