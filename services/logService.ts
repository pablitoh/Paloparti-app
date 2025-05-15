import { LogAction } from '../utils/logTypes';

/**
 * Interface for log entry data
 */
interface LogEntryData {
  groupId: string;
  action: string;
  performedBy: string;
  performedByName: string;
  targetUserId: string;
  targetUserName: string;
  details: any;
  timestamp: string;
}

/**
 * Creates a log entry in the database
 *
 * @param data LogEntryData containing information about the action
 * @returns Promise resolving to the created log entry
 */
export async function createLogEntry(data: LogEntryData): Promise<any> {
  try {
    const response = await fetch(`/api/groups/${data.groupId}/logs/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: data.action,
        performedBy: data.performedBy,
        performedByName: data.performedByName,
        targetUserId: data.targetUserId,
        targetUserName: data.targetUserName,
        details: data.details,
      }),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Error creating log entry');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating log entry:', error);
    // Return empty success to avoid breaking the application flow
    return { success: false };
  }
}
