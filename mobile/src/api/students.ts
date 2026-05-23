import apiClient from './client';
import { Student } from '../types';

export async function getStudentsForSection(sectionId: string): Promise<Student[]> {
  const response = await apiClient.get<Student[]>(`/sections/${sectionId}/students`);
  return response.data;
}
