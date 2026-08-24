import React, { useState, useEffect } from 'react';
import { RocketLaunchIcon, PlayCircleIcon, XMarkIcon } from './icons';
import { supabase, getCleanImageUrl } from '../supabaseClient';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';
import { useToast } from './ToastContext';

interface QuizQuestion {
    questionText: string;
    options: string[];
    correctOptionIndex: number;
}

interface TrainingModule {
    id: string;
    title: string;
    duration: string;
    thumbnail: string;
    videoUrl?: string;
    category?: string;
    participants?: string[];
    startDate?: string;
    endDate?: string;
    pdfUrl?: string;
    quiz?: QuizQuestion[];
}

interface Submission {
    id: string;
    training_id: string;
    score: number;
    employee_id: string;
    completed_at?: string;
    answers: number[];
}

function getEmbedUrl(url: string): string {
    if (!url) return '';
    if (url.includes('youtube.com/watch?v=')) {
        const id = url.split('watch?v=')[1]?.split('&')[0];
        return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes('youtu.be/')) {
        const id = url.split('youtu.be/')[1]?.split('?')[0];
        return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes('youtube.com/shorts/')) {
        const id = url.split('shorts/')[1]?.split('?')[0];
        return `https://www.youtube.com/embed/${id}`;
    }
    if (url.includes('vimeo.com/')) {
        const id = url.split('vimeo.com/')[1]?.split('?')[0];
        return `https://player.vimeo.com/video/${id}`;
    }
    return url;
}

const isDirectVideoUrl = (url: string) => {
    if (!url) return false;
    return url.match(/\.(mp4|webm|ogg)$/i) || url.includes('/storage/v1/object/public/');
};

const TrainingPage: React.FC = () => {
    const { t } = useLanguage();
    const { currentUser } = useAuth();
    const { showToast } = useToast();
    const [trainings, setTrainings] = useState<TrainingModule[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);

    // Active training/quiz state
    const [selectedTraining, setSelectedJob] = useState<TrainingModule | null>(null);
    const [showQuizModal, setShowQuizModal] = useState(false);
    const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
    const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);

    const fetchData = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            // Fetch all company training modules
            const { data: trainData, error: trainError } = await supabase
                .from('training_modules')
                .select('*')
                .eq('company_id', currentUser.company_id);

            if (trainError) throw trainError;

            // Fetch user submissions
            const { data: subData, error: subError } = await supabase
                .from('training_submissions')
                .select('*')
                .eq('employee_id', currentUser.id);

            if (subError) throw subError;

            if (trainData) {
                // Filter only trainings where the user is a participant
                const userTrainings = trainData
                    .filter((t: any) => t.participants && t.participants.includes(currentUser.id))
                    .map((t: any) => ({
                        id: t.id,
                        title: t.title,
                        duration: t.duration || '0 min',
                        thumbnail: t.thumbnail || '',
                        videoUrl: t.video_url || '',
                        category: t.category || '',
                        participants: t.participants || [],
                        startDate: t.start_date || '',
                        endDate: t.end_date || '',
                        pdfUrl: t.pdf_url || '',
                        quiz: t.quiz || []
                    }));

                setTrainings(userTrainings);
            }

            if (subData) {
                setSubmissions(subData);
            }
        } catch (err) {
            console.error("Error fetching trainings page data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentUser?.id, currentUser?.company_id]);

    useEffect(() => {
        const handleYTMessage = (event: MessageEvent) => {
            if (!event.origin.includes('youtube.com')) return;
            
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                const isEnded = 
                    (data.event === 'onStateChange' && data.info === 0) ||
                    (data.event === 'infoDelivery' && data.info && data.info.playerState === 0);
                
                if (isEnded && selectedTraining && !getTrainingStatus(selectedTraining.id).completed) {
                    console.log("[PandaNet] YouTube Video Ended. Triggering quiz automatically...");
                    handleStartQuiz();
                }
            } catch (err) {
                // Ignore parse errors from other message events
            }
        };

        window.addEventListener('message', handleYTMessage);
        return () => {
            window.removeEventListener('message', handleYTMessage);
        };
    }, [selectedTraining, submissions]);

    const handleOpenTraining = (training: TrainingModule) => {
        setSelectedJob(training);
        setQuizAnswers(new Array(training.quiz?.length || 0).fill(-1));
    };

    const handleStartQuiz = () => {
        if (!selectedTraining) return;
        setQuizAnswers(new Array(selectedTraining.quiz?.length || 0).fill(-1));
        setShowQuizModal(true);
    };

    const handleQuizOptionSelect = (qIndex: number, oIndex: number) => {
        setQuizAnswers(prev => {
            const updated = [...prev];
            updated[qIndex] = oIndex;
            return updated;
        });
    };

    const handleSubmitQuiz = async () => {
        if (!selectedTraining || !currentUser) return;

        // Validation: ensure all questions are answered
        const unanswered = quizAnswers.some(ans => ans === -1);
        if (unanswered) {
            showToast('Por favor, responda todas as perguntas antes de enviar.', 'warning');
            return;
        }

        setIsSubmittingQuiz(true);
        try {
            // Calculate score
            const quiz = selectedTraining.quiz || [];
            let correctCount = 0;
            quiz.forEach((q, idx) => {
                if (q.correctOptionIndex === quizAnswers[idx]) {
                    correctCount++;
                }
            });

            const score = quiz.length > 0 ? Math.round((correctCount / quiz.length) * 100) : 100;

            const { error } = await supabase
                .from('training_submissions')
                .insert([{
                    company_id: currentUser.company_id,
                    training_id: selectedTraining.id,
                    employee_id: currentUser.id,
                    answers: quizAnswers,
                    score,
                    status: 'pending',
                    completed_at: new Date().toISOString()
                }]);

            if (error) throw error;

            showToast(`Quiz concluído! Você acertou ${correctCount} de ${quiz.length} perguntas (${score}%).`, 'success');
            setShowQuizModal(false);
            setSelectedJob(null);
            fetchData();
        } catch (err: any) {
            console.error('Error submitting quiz:', err);
            showToast('Erro ao enviar avaliação: ' + err.message, 'error');
        } finally {
            setIsSubmittingQuiz(false);
        }
    };

    const getTrainingStatus = (trainingId: string) => {
        const sub = submissions.find(s => s.training_id === trainingId);
        return sub 
            ? { completed: true, score: sub.score, status: sub.status || 'pending' } 
            : { completed: false, score: 0, status: 'none' };
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando seus treinamentos...</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                        <RocketLaunchIcon className="w-8 h-8 mr-3 text-brand-primary" />
                        Seus Treinamentos
                    </h1>
                    <p className="mt-2 text-brand-subtle-text text-lg">Aprimore suas competências e acompanhe suas convocações obrigatórias.</p>
                </div>
            </div>

            {selectedTraining ? (
                /* Training Details / View Area */
                <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border dark:border-white/5 shadow-md space-y-6 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center border-b dark:border-white/5 pb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedTraining.title}</h2>
                            <p className="text-sm text-gray-500">{selectedTraining.category} • Duração: {selectedTraining.duration}</p>
                        </div>
                        <button
                            onClick={() => setSelectedJob(null)}
                            className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-200 rounded-lg"
                        >
                            &larr; Voltar
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Video Player Column */}
                        <div className="lg:col-span-2 space-y-4">
                            {selectedTraining.videoUrl ? (
                                isDirectVideoUrl(selectedTraining.videoUrl) ? (
                                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border dark:border-white/5 shadow">
                                        <video
                                            src={selectedTraining.videoUrl}
                                            controls
                                            onEnded={handleStartQuiz}
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                ) : (
                                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border dark:border-white/5 shadow">
                                        <iframe
                                            src={getEmbedUrl(selectedTraining.videoUrl) + (getEmbedUrl(selectedTraining.videoUrl).includes('?') ? '&enablejsapi=1' : '?enablejsapi=1')}
                                            title={selectedTraining.title}
                                            className="w-full h-full border-0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        ></iframe>
                                    </div>
                                )
                            ) : (
                                <div className="aspect-video w-full rounded-xl bg-gray-100 dark:bg-slate-900 flex flex-col items-center justify-center text-gray-400 border border-dashed">
                                    <PlayCircleIcon className="w-16 h-16 opacity-40 mb-2" />
                                    <p className="font-semibold">Nenhum vídeo anexado a este treinamento.</p>
                                    <p className="text-xs">Consulte o material de apoio em PDF.</p>
                                </div>
                            )}
                        </div>

                        {/* Actions / Materials Column */}
                        <div className="space-y-6">
                            <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-xl space-y-4 border dark:border-white/5">
                                <h3 className="font-bold text-gray-900 dark:text-white">Material de Apoio</h3>
                                {selectedTraining.pdfUrl ? (
                                    <a
                                        href={selectedTraining.pdfUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-brand-primary text-white font-semibold rounded-lg hover:bg-emerald-600 shadow transition-colors text-sm"
                                    >
                                        <span>Download Material (PDF)</span>
                                    </a>
                                ) : (
                                    <p className="text-sm text-gray-500">Nenhum documento PDF disponível.</p>
                                )}
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-xl space-y-4 border dark:border-white/5">
                                <h3 className="font-bold text-gray-900 dark:text-white">Avaliação</h3>
                                {selectedTraining.quiz && selectedTraining.quiz.length > 0 ? (
                                    (() => {
                                        const status = getTrainingStatus(selectedTraining.id);
                                        if (status.completed) {
                                            if (status.status === 'pending') {
                                                return (
                                                    <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50">
                                                        <p className="font-bold text-sm">Avaliação Enviada!</p>
                                                        <p className="text-xs mt-1">Aguardando correção pelo administrador.</p>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
                                                    <p className="font-bold text-sm">Treinamento Concluído!</p>
                                                    <p className="text-xs mt-1">Sua nota: <strong className="text-sm">{status.score}%</strong></p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <button
                                                onClick={handleStartQuiz}
                                                className="w-full py-3 bg-brand-primary text-white font-semibold rounded-lg hover:bg-emerald-600 transition-colors shadow text-sm"
                                            >
                                                Realizar Avaliação
                                            </button>
                                        );
                                    })()
                                ) : (
                                    <p className="text-sm text-gray-500">Este treinamento não exige teste ou avaliação de conhecimentos.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Grid of Trainings */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {trainings.length > 0 ? (
                        trainings.map(training => {
                            const status = getTrainingStatus(training.id);

                            return (
                                <div
                                    key={training.id}
                                    onClick={() => handleOpenTraining(training)}
                                    className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-white/5 overflow-hidden hover:shadow-md transition-all group cursor-pointer flex flex-col"
                                >
                                    <div className="relative h-48 bg-slate-100 dark:bg-slate-900">
                                        {training.thumbnail ? (
                                            <img
                                                src={getCleanImageUrl(training.thumbnail)}
                                                alt={training.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <RocketLaunchIcon className="w-16 h-16 opacity-30" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/35 group-hover:bg-black/45 transition-colors flex items-center justify-center">
                                            <PlayCircleIcon className="w-14 h-14 text-white opacity-85 group-hover:opacity-100 group-hover:scale-115 transition-all" />
                                        </div>
                                        <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[10px] px-2 py-0.5 rounded font-medium">{training.duration}</span>
                                        {status.completed && (
                                            status.status === 'pending' ? (
                                                <span className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow">Aguardando Correção</span>
                                            ) : (
                                                <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow">Concluído</span>
                                            )
                                        )}
                                    </div>
                                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                        <div>
                                            <span className="text-[10px] font-bold text-brand-primary dark:text-emerald-400 uppercase tracking-widest">{training.category}</span>
                                            <h3 className="font-bold text-gray-900 dark:text-white mt-1 group-hover:text-brand-primary transition-colors text-base line-clamp-1">{training.title}</h3>
                                            {training.endDate && (
                                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                                    Prazo: {new Date(training.endDate).toLocaleDateString('pt-BR')}
                                                </p>
                                            )}
                                        </div>
                                        <button className="w-full py-2 bg-gray-50 dark:bg-slate-700/50 text-brand-primary dark:text-emerald-400 font-semibold rounded-lg group-hover:bg-brand-primary group-hover:text-white transition-colors text-xs uppercase tracking-wider">
                                            Acessar Curso
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="col-span-full py-16 text-center text-gray-500 bg-gray-55 dark:bg-slate-800 rounded-xl border border-dashed border-gray-300 dark:border-white/5">
                            <RocketLaunchIcon className="w-12 h-12 mx-auto text-gray-400 opacity-50 mb-3" />
                            <p className="font-medium">Nenhum treinamento convocado para você no momento.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Quiz Modal */}
            {showQuizModal && selectedTraining && (
                <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-xl max-h-[85vh] overflow-y-auto p-6 relative animate-in fade-in zoom-in-95 duration-200">
                        <button
                            onClick={() => setShowQuizModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                            disabled={isSubmittingQuiz}
                        >
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Avaliação de Conhecimento</h3>
                        <p className="text-xs text-gray-500 mb-6 border-b dark:border-white/5 pb-2">Responda às questões com base no material disponibilizado.</p>

                        <div className="space-y-6">
                            {selectedTraining.quiz?.map((q, qIndex) => (
                                <div key={qIndex} className="space-y-3">
                                    <h4 className="font-bold text-sm text-gray-900 dark:text-white flex">
                                        <span className="text-brand-primary mr-1.5">{qIndex + 1}.</span> {q.questionText}
                                    </h4>
                                    <div className="space-y-2">
                                        {q.options.map((opt, oIndex) => (
                                            <label
                                                key={oIndex}
                                                className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-slate-850 ${
                                                    quizAnswers[qIndex] === oIndex
                                                        ? 'border-brand-primary bg-emerald-50/50 dark:bg-emerald-950/10'
                                                        : 'border-gray-200 dark:border-gray-700'
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name={`question_${qIndex}`}
                                                    checked={quizAnswers[qIndex] === oIndex}
                                                    onChange={() => handleQuizOptionSelect(qIndex, oIndex)}
                                                    className="text-brand-primary focus:ring-brand-primary"
                                                />
                                                <span className="text-sm font-medium text-gray-800 dark:text-gray-300">{opt}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end space-x-3 pt-6 border-t dark:border-white/5 mt-8">
                            <button
                                type="button"
                                onClick={() => setShowQuizModal(false)}
                                disabled={isSubmittingQuiz}
                                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmitQuiz}
                                disabled={isSubmittingQuiz}
                                className="px-6 py-2 text-sm font-semibold text-white bg-brand-primary rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                            >
                                {isSubmittingQuiz ? 'Enviando...' : 'Finalizar e Enviar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrainingPage;
