import React from 'react';
import RecognitionWall from './RecognitionWall';
import type { Recognition, Employee } from '../types';

interface RecognitionPageProps {
  recognitions?: Recognition[];
  employees?: Employee[];
  currentUser?: Employee;
  onAddRecognition?: (rec: Recognition) => void;
}

const RecognitionPage: React.FC<RecognitionPageProps> = ({ recognitions, employees, currentUser, onAddRecognition }) => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-brand-text">Mural de Reconhecimento</h1>
      <p className="text-brand-subtle-text">Celebre as conquistas e os valores da nossa equipe.</p>
      <RecognitionWall
        recognitions={recognitions}
        employees={employees}
        currentUser={currentUser}
        onAddRecognition={onAddRecognition}
      />
    </div>
  );
};

export default RecognitionPage;
