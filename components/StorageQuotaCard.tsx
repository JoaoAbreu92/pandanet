import React, {
    useCallback,
    useEffect,
    useState
} from 'react';

import {
    ArrowPathIcon,
    CircleStackIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';


interface StorageQuota {
    company_id: string;
    plan_limit_gb: number;
    override_limit_gb: number | null;
    effective_limit_gb: number;
    used_bytes: number;
    limit_bytes: number;
    remaining_bytes: number;
    used_gb: number;
    remaining_gb: number;
    percentage: number;
    status:
        | 'normal'
        | 'warning'
        | 'critical'
        | 'limit';
}


const StorageQuotaCard: React.FC = () => {

    const { currentUser } = useAuth();

    const [quota, setQuota] =
        useState<StorageQuota | null>(null);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);


    const canView =
        Boolean(currentUser?.company_id)
        && (
            Boolean(currentUser?.isCompanyAdmin)
            || Boolean(currentUser?.isAdmin)
        );


    const loadQuota = useCallback(async () => {

        if (!canView) {
            return;
        }

        setLoading(true);
        setError(null);

        try {

            const {
                data,
                error
            } = await supabase.rpc(
                'get_my_company_storage_quota'
            );

            if (error) {
                throw error;
            }

            setQuota(
                data as StorageQuota
            );

        } catch (err: any) {

            console.error(
                '[StorageQuotaCard]',
                err
            );

            setError(
                err?.message
                || 'Não foi possível carregar o armazenamento.'
            );

        } finally {
            setLoading(false);
        }

    }, [canView]);


    useEffect(() => {

        if (canView) {
            loadQuota();
        }

    }, [
        canView,
        loadQuota
    ]);


    if (!canView) {
        return null;
    }


    const percentage =
        Math.min(
            Number(quota?.percentage || 0),
            100
        );


    const statusLabel =
        quota?.status === 'limit'
            ? 'Limite atingido'
            : quota?.status === 'critical'
                ? 'Crítico'
                : quota?.status === 'warning'
                    ? 'Atenção'
                    : 'Normal';


    const badgeClass =
        quota?.status === 'limit'
            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/40'
            : quota?.status === 'critical'
                ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-300 dark:border-orange-900/40'
                : quota?.status === 'warning'
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/40'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/40';


    const barClass =
        quota?.status === 'limit'
            ? 'bg-red-500'
            : quota?.status === 'critical'
                ? 'bg-orange-500'
                : quota?.status === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500';


    return (
        <div className="
            w-full
            bg-white
            dark:bg-slate-900
            border
            border-slate-200/80
            dark:border-slate-800
            rounded-2xl
            shadow-sm
            p-5
        ">

            <div className="
                flex
                items-start
                justify-between
                gap-4
            ">

                <div className="
                    flex
                    items-center
                    gap-3
                ">

                    <div className="
                        w-11
                        h-11
                        rounded-xl
                        bg-blue-50
                        dark:bg-blue-950/30
                        flex
                        items-center
                        justify-center
                    ">
                        <CircleStackIcon
                            className="
                                w-6
                                h-6
                                text-blue-600
                            "
                        />
                    </div>

                    <div>
                        <h3 className="
                            font-black
                            text-slate-900
                            dark:text-white
                        ">
                            Armazenamento
                        </h3>

                        <p className="
                            text-xs
                            text-slate-400
                            mt-0.5
                        ">
                            Espaço de arquivos da sua empresa
                        </p>
                    </div>

                </div>


                <button
                    type="button"
                    onClick={loadQuota}
                    disabled={loading}
                    title="Atualizar armazenamento"
                    className="
                        p-2
                        rounded-lg
                        text-slate-400
                        hover:text-blue-600
                        hover:bg-blue-50
                        dark:hover:bg-blue-950/20
                        transition-colors
                    "
                >
                    <ArrowPathIcon
                        className={`
                            w-5
                            h-5
                            ${loading ? 'animate-spin' : ''}
                        `}
                    />
                </button>

            </div>


            {error ? (

                <div className="
                    mt-4
                    p-3
                    rounded-xl
                    bg-red-50
                    border
                    border-red-200
                    text-red-700
                    text-xs
                ">
                    {error}
                </div>

            ) : loading && !quota ? (

                <div className="
                    py-8
                    flex
                    items-center
                    justify-center
                ">
                    <ArrowPathIcon
                        className="
                            w-6
                            h-6
                            animate-spin
                            text-blue-600
                        "
                    />
                </div>

            ) : quota ? (

                <div className="mt-5 space-y-4">

                    <div className="
                        flex
                        items-end
                        justify-between
                        gap-4
                    ">

                        <div>
                            <p className="
                                text-2xl
                                font-black
                                text-slate-900
                                dark:text-white
                            ">
                                {Number(
                                    quota.used_gb
                                ).toFixed(2)}

                                <span className="
                                    text-sm
                                    font-bold
                                    text-slate-400
                                ">
                                    {' '}GB
                                </span>
                            </p>

                            <p className="
                                text-xs
                                text-slate-400
                            ">
                                de{' '}
                                {Number(
                                    quota.effective_limit_gb
                                ).toFixed(2)}
                                {' '}GB
                            </p>
                        </div>


                        <span
                            className={`
                                px-2.5
                                py-1
                                rounded-full
                                border
                                text-[10px]
                                font-black
                                uppercase
                                tracking-wider
                                ${badgeClass}
                            `}
                        >
                            {statusLabel}
                        </span>

                    </div>


                    <div>

                        <div className="
                            h-3
                            bg-slate-100
                            dark:bg-slate-800
                            rounded-full
                            overflow-hidden
                        ">

                            <div
                                className={`
                                    h-full
                                    rounded-full
                                    transition-all
                                    duration-500
                                    ${barClass}
                                `}
                                style={{
                                    width:
                                        `${percentage}%`
                                }}
                            />

                        </div>


                        <div className="
                            flex
                            justify-between
                            mt-2
                            text-[11px]
                            font-bold
                            text-slate-400
                        ">

                            <span>
                                {Number(
                                    quota.percentage
                                ).toFixed(1)}
                                % utilizado
                            </span>

                            <span>
                                {Number(
                                    quota.remaining_gb
                                ).toFixed(2)}
                                {' '}GB disponíveis
                            </span>

                        </div>

                    </div>


                    {quota.percentage >= 80 && (

                        <div
                            className={`
                                flex
                                gap-2
                                p-3
                                rounded-xl
                                border
                                text-xs
                                ${badgeClass}
                            `}
                        >

                            <ExclamationTriangleIcon
                                className="
                                    w-5
                                    h-5
                                    shrink-0
                                "
                            />

                            <p>
                                {quota.percentage >= 100
                                    ? 'O limite de armazenamento foi atingido. Novos uploads serão bloqueados até existir espaço disponível ou o limite ser ampliado.'
                                    : `Sua empresa já utilizou ${Number(quota.used_gb).toFixed(2)} GB do limite de ${Number(quota.effective_limit_gb).toFixed(2)} GB.`}
                            </p>

                        </div>

                    )}


                    {quota.override_limit_gb !== null && (

                        <p className="
                            text-[10px]
                            font-bold
                            text-purple-500
                        ">
                            Limite personalizado definido pelo administrador da plataforma.
                        </p>

                    )}

                </div>

            ) : null}

        </div>
    );
};


export default StorageQuotaCard;
