import React, { useState } from 'react';
import { MessageSquare, X, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';

export function PilotFeedback() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState({
    type: 'bug' as 'bug' | 'feature' | 'confusing' | 'other',
    message: '',
    urgency: 'medium' as 'low' | 'medium' | 'high'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;

    setIsSubmitting(true);
    try {
      // Log feedback to audit_logs for now as a lightweight way to capture it
      const { error } = await supabase.from('audit_logs').insert([{
        tenant_id: profile.tenant_id,
        user_id: profile.id,
        action: 'PILOT_FEEDBACK',
        entity_type: 'feedback',
        entity_id: profile.id,
        metadata: {
          ...feedback,
          user_email: profile.email,
          user_name: profile.full_name,
          timestamp: new Date().toISOString()
        }
      }]);

      if (error) throw error;

      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setFeedback({ type: 'bug', message: '', urgency: 'medium' });
      }, 3000);
    } catch (error: any) {
      toast.error('Failed to send feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center w-full px-4 py-3 text-sm font-medium text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
      >
        <MessageSquare className="mr-3 h-5 w-5" />
        Pilot Feedback
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="bg-blue-600 p-6 text-white flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Pilot Feedback</h2>
                  <p className="text-blue-100 text-xs mt-1">Help us improve Debrios for your team.</p>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6">
                {submitted ? (
                  <div className="text-center py-8 space-y-4">
                    <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Thank You!</h3>
                    <p className="text-gray-500">Your feedback has been logged and sent to our product team.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Feedback Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'bug', label: 'Bug Report' },
                          { id: 'feature', label: 'Feature Request' },
                          { id: 'confusing', label: 'Confusing UX' },
                          { id: 'other', label: 'Other' }
                        ].map((type) => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setFeedback({ ...feedback, type: type.id as any })}
                            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                              feedback.type === type.id
                                ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-500/20'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Urgency</label>
                      <select
                        value={feedback.urgency}
                        onChange={(e) => setFeedback({ ...feedback, urgency: e.target.value as any })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="low">Low - Just an idea</option>
                        <option value="medium">Medium - Affecting workflow</option>
                        <option value="high">High - Blocking operations</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Your Message</label>
                      <textarea
                        required
                        rows={4}
                        value={feedback.message}
                        onChange={(e) => setFeedback({ ...feedback, message: e.target.value })}
                        placeholder="Describe the issue or suggestion in detail..."
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      />
                    </div>

                    <div className="bg-amber-50 p-4 rounded-lg flex items-start">
                      <AlertCircle className="h-5 w-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] text-amber-800 leading-relaxed">
                        For critical operational blocks, please also email <strong>adeelrazzaq89@gmail.com</strong> for immediate assistance.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send size={18} className="mr-2" />
                          Send Feedback
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
