import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { X, User, Users, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../AuthContext';

interface TransferModalProps {
  conversationId: string;
  currentAssignedTo?: string | null;
  currentDepartmentId?: string | null;
  onClose: () => void;
  onTransferComplete: () => void;
}

interface Agent {
  id: string;
  full_name: string;
  avatar_url?: string;
  department_id?: string;
}

interface Department {
  id: string;
  name: string;
}

const TransferModal: React.FC<TransferModalProps> = ({
  conversationId,
  currentAssignedTo,
  currentDepartmentId,
  onClose,
  onTransferComplete
}) => {
  const { profile } = useAuth();
  const [transferType, setTransferType] = useState<'user' | 'department'>('user');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
    fetchDepartments();
  }, []);

  const fetchAgents = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, department_id')
      .eq('is_whatsapp_agent', true)
      .eq('company_id', profile?.company_id)
      .order('full_name');

    if (data) setAgents(data);
    if (error) console.error('Error fetching agents:', error);
  };

  const fetchDepartments = async () => {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .eq('company_id', profile?.company_id)
      .order('name');

    if (data) setDepartments(data);
    if (error) console.error('Error fetching departments:', error);
  };

  const handleTransfer = async () => {
    setLoading(true);
    setError(null);

    try {
      // Validate permissions
      const canTransfer = profile?.isAdmin || profile?.isCompanyAdmin || 
                         profile?.whatspanda_permissions?.can_transfer;
      
      if (!canTransfer) {
        setError('Você não tem permissão para transferir atendimentos');
        setLoading(false);
        return;
      }

      const updateData: any = {};

      if (transferType === 'user' && selectedUserId) {
        updateData.assigned_to = selectedUserId;
        updateData.department_id = null; // Clear department when assigning to user
      } else if (transferType === 'department' && selectedDepartmentId) {
        updateData.department_id = selectedDepartmentId;
        updateData.assigned_to = null; // Clear user when assigning to department
      } else {
        setError('Selecione um usuário ou setor para transferir');
        setLoading(false);
        return;
      }

      updateData.updated_at = new Date().toISOString();

      // Update conversation
      const { error: updateError } = await supabase
        .from('whatsapp_conversations')
        .update(updateData)
        .eq('id', conversationId);

      if (updateError) throw updateError;

      // Create notification if transferring to user
      if (transferType === 'user' && selectedUserId) {
        const agent = agents.find(a => a.id === selectedUserId);
        await supabase.from('notifications').insert({
          user_id: selectedUserId,
          company_id: profile?.company_id,
          type: 'whatsapp_transfer',
          title: 'Novo Atendimento Atribuído',
          description: `${profile?.name} transferiu um atendimento para você`,
          link: `/whatspanda?view=chat&id=${conversationId}`
        });
      }

      onTransferComplete();
      onClose();
    } catch (err: any) {
      console.error('Transfer error:', err);
      setError(err.message || 'Erro ao transferir atendimento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-900">Transferir Atendimento</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Transfer Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Transferir para:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTransferType('user')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  transferType === 'user'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <User className={`w-6 h-6 mx-auto mb-2 ${
                  transferType === 'user' ? 'text-green-600' : 'text-gray-400'
                }`} />
                <p className={`text-sm font-medium ${
                  transferType === 'user' ? 'text-green-900' : 'text-gray-600'
                }`}>
                  Usuário
                </p>
              </button>

              <button
                onClick={() => setTransferType('department')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  transferType === 'department'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Users className={`w-6 h-6 mx-auto mb-2 ${
                  transferType === 'department' ? 'text-green-600' : 'text-gray-400'
                }`} />
                <p className={`text-sm font-medium ${
                  transferType === 'department' ? 'text-green-900' : 'text-gray-600'
                }`}>
                  Setor
                </p>
              </button>
            </div>
          </div>

          {/* User Selection */}
          {transferType === 'user' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecione o Agente
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Escolha um agente...</option>
                {agents.map((agent) => (
                  <option 
                    key={agent.id} 
                    value={agent.id}
                    disabled={agent.id === currentAssignedTo}
                  >
                    {agent.full_name} {agent.id === currentAssignedTo ? '(Atual)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Department Selection */}
          {transferType === 'department' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecione o Setor
              </label>
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Escolha um setor...</option>
                {departments.map((dept) => (
                  <option 
                    key={dept.id} 
                    value={dept.id}
                    disabled={dept.id === currentDepartmentId}
                  >
                    {dept.name} {dept.id === currentDepartmentId ? '(Atual)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleTransfer}
            disabled={loading || (!selectedUserId && !selectedDepartmentId)}
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md shadow-green-600/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Transferindo...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Confirmar Transferência
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferModal;
