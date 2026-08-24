import React from 'react';
import { StarIcon, TrophyIcon } from './icons';
import type { Employee } from '../types';

interface EmployeeOfTheMonthProps {
    employee: Employee;
}

const EmployeeOfTheMonth: React.FC<EmployeeOfTheMonthProps> = ({ employee }) => {
    return (
        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg shadow-sm p-4 border border-amber-100 flex flex-col items-center mt-6 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 -mr-4 -mt-4 text-amber-100 opacity-50">
                <TrophyIcon className="w-24 h-24" />
            </div>

            <div className="relative z-10 text-center">
                <div className="inline-flex items-center justify-center space-x-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold mb-3 uppercase tracking-wider shadow-sm">
                    <StarIcon className="w-3.5 h-3.5 text-amber-500" />
                    <span>Destaque do Mês</span>
                </div>

                <div className="relative mb-3 inline-block">
                    <img
                        src={employee.avatarUrl}
                        alt={employee.name}
                        className="w-20 h-20 rounded-full border-4 border-white shadow-md object-cover"
                    />
                    <div className="absolute bottom-0 right-0 bg-amber-500 text-white p-1 rounded-full border-2 border-white">
                        <TrophyIcon className="w-3 h-3" />
                    </div>
                </div>

                <h3 className="font-bold text-gray-800 text-base">{employee.name}</h3>
                <p className="text-xs text-gray-500 font-medium mb-3">{employee.role}</p>

                <p className="text-xs text-gray-600 italic">"Pela dedicação excepcional e liderança no projeto Phoenix."</p>
            </div>
        </div>
    );
};

export default EmployeeOfTheMonth;
