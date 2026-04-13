import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Database } from '../../../types/database';
import { UserPlus, Mail, Shield, AlertCircle, X, CheckCircle2, Clock, MoreVertical, UserMinus, UserCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { cn } from '../../../lib/utils';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Invite = Database['public']['Tables']['team_invites']['Row'];

export function AccessControl() {
  const { profile, appReady } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const [newInvite, setNewInvite] = useState({
    email: '',
    role: 'dispatcher' as 'admin' | 'dispatcher' | 'driver'
  });

  const fetchData = async () => {
    if (!appReady || !profile?.tenant_id) return;

    try {
      setLoading(true);
      const [membersRes, invitesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*', { count: 'exact' })
          .eq('tenant_id', profile.tenant_id)
          .order('full_name')
          .range(page * pageSize, (page + 1) * pageSize - 1),
        supabase
          .from('team_invites')
          .select('*')
          .eq('tenant_id', profile.tenant_id)
          .order('created_at', { ascending: false })
      ]);

      if (membersRes.error) throw membersRes.error;
      if (invitesRes.error) throw invitesRes.error;

      setMembers(membersRes.data || []);
      setTotalMembers(membersRes.count || 0);
      setInvites(invitesRes.data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!appReady || !profile?.tenant_id) return;
    fetchData();
  }, [profile?.tenant_id, page, appReady]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;
    
    setIsSubmitting(true);
    const toastId = toast.loading('Sending invite...');

    try {
      // 1. Check if user already exists in profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', newInvite.email)
        .single();

      if (existingProfile) {
        toast.error('A user with this email already exists in the system.', { id: toastId });
        setIsSubmitting(false);
        return;
      }

      // 2. Check if a pending invite already exists
      const { data: existingInvite } = await supabase
        .from('team_invites')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .eq('email', newInvite.email)
        .eq('status', 'pending')
        .single();

      if (existingInvite) {
        toast.error('A pending invitation already exists for this email.', { id: toastId });
        setIsSubmitting(false);
        return;
      }

      // 3. Create invite record
      const { error: inviteError } = await supabase
        .from('team_invites')
        .insert([{
          tenant_id: profile.tenant_id,
          email: newInvite.email,
          role: newInvite.role,
          status: 'pending'
        }]);

      if (inviteError) throw inviteError;

      // 2. Send magic link via Supabase Auth
      // Note: In a real app, this would trigger an email.
      // signInWithOtp creates the user if they don't exist.
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: newInvite.email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (authError) throw authError;

      // Log invite to audit_logs
      await supabase.from('audit_logs').insert([{
        tenant_id: profile.tenant_id,
        user_id: profile.id,
        action: 'TEAM_INVITE_SENT',
        entity_type: 'invite',
        entity_id: newInvite.email,
        metadata: {
          email: newInvite.email,
          role: newInvite.role
        }
      }]);

      toast.success('Invite sent successfully!', { id: toastId });
      setIsModalOpen(false);
      setNewInvite({ email: '', role: 'dispatcher' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (userId: string, role: 'admin' | 'dispatcher' | 'driver') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      toast.success('Role updated successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleUpdateStatus = async (userId: string, status: 'active' | 'inactive') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      toast.success(`User ${status === 'active' ? 'activated' : 'deactivated'} successfully`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading && members.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-500">Manage your company members and their roles.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </button>
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members.map((member) => (
                <tr key={member.id} className={cn("hover:bg-gray-50 transition-colors", member.status === 'inactive' && "opacity-60")}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center",
                        member.status === 'active' ? "bg-blue-100" : "bg-gray-100"
                      )}>
                        <Shield className={cn("h-5 w-5", member.status === 'active' ? "text-blue-600" : "text-gray-400")} />
                      </div>
                      <div className="ml-4">
                        <div className="font-medium text-gray-900">{member.full_name || 'New Member'}</div>
                        <div className="text-sm text-gray-500">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {profile?.id !== member.id ? (
                      <select
                        value={member.role || ''}
                        onChange={(e) => handleUpdateRole(member.id, e.target.value as any)}
                        className="text-xs font-medium bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="admin">Admin</option>
                        <option value="dispatcher">Dispatcher</option>
                        <option value="driver">Driver</option>
                      </select>
                    ) : (
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-xs font-medium capitalize",
                        member.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        member.role === 'dispatcher' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      )}>
                        {member.role}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      "flex items-center text-sm",
                      member.status === 'active' ? "text-green-600" : "text-red-600"
                    )}>
                      {member.status === 'active' ? (
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                      ) : (
                        <AlertCircle className="h-4 w-4 mr-1" />
                      )}
                      {member.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {member.last_active_at ? formatDistanceToNow(new Date(member.last_active_at), { addSuffix: true }) : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {profile?.id !== member.id && (
                      <button
                        onClick={() => handleUpdateStatus(member.id, member.status === 'active' ? 'inactive' : 'active')}
                        className={cn(
                          "inline-flex items-center px-2 py-1 rounded transition-colors",
                          member.status === 'active' ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50"
                        )}
                        title={member.status === 'active' ? "Deactivate" : "Activate"}
                      >
                        {member.status === 'active' ? <UserMinus size={16} /> : <UserCheck size={16} />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {invites.filter(i => i.status === 'pending').map((invite) => (
                <tr key={invite.id} className="bg-gray-50/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="ml-4">
                        <div className="font-medium text-gray-500 italic">Invited</div>
                        <div className="text-sm text-gray-500">{invite.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-xs font-medium capitalize opacity-60",
                      invite.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      invite.role === 'dispatcher' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    )}>
                      {invite.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="flex items-center text-sm text-amber-600">
                      <Clock className="h-4 w-4 mr-1" />
                      Pending
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 italic">
                    Invited on {new Date(invite.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing <span className="font-medium">{page * pageSize + 1}</span> to{' '}
            <span className="font-medium">{Math.min((page + 1) * pageSize, totalMembers)}</span> of{' '}
            <span className="font-medium">{totalMembers}</span> results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * pageSize >= totalMembers}
              className="p-2 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Invite Team Member</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input
                  required
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="colleague@company.com"
                  value={newInvite.email}
                  onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newInvite.role}
                  onChange={(e) => setNewInvite({ ...newInvite, role: e.target.value as any })}
                >
                  <option value="admin">Admin (Full Access)</option>
                  <option value="dispatcher">Dispatcher (Manage Fleet)</option>
                  <option value="driver">Driver (Mobile Interface Only)</option>
                </select>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg flex items-start">
                <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  Invited users will receive a magic link to sign in. Their role and company access will be automatically configured upon their first login.
                </p>
              </div>
              <div className="flex justify-end space-x-3 mt-8">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
