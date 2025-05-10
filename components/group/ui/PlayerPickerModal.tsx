import React, { useState } from 'react';

interface Player {
  id: string;
  name: string;
  avatar?: string;
  position?: string;
  number?: number;
  isSelected?: boolean;
}

interface PlayerPickerModalProps {
  players: Player[];
  title?: string;
  maxSelections?: number;
  onSelect: (selectedPlayers: Player[]) => void;
  onCancel: () => void;
  initialSelectedIds?: string[];
  showPositionFilter?: boolean;
  showSearchBox?: boolean;
}

export default function PlayerPickerModal({
  players,
  title = 'Seleccionar jugadores',
  maxSelections,
  onSelect,
  onCancel,
  initialSelectedIds = [],
  showPositionFilter = true,
  showSearchBox = true,
}: PlayerPickerModalProps) {
  const [selectedPlayerIds, setSelectedPlayerIds] =
    useState<string[]>(initialSelectedIds);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);

  // Extraer posiciones únicas
  const uniquePositions = Array.from(
    new Set(players.filter((p) => p.position).map((p) => p.position as string))
  );

  // Filtrar jugadores
  const filteredPlayers = players.filter((player) => {
    const matchesSearch = player.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesPosition =
      !selectedPosition || player.position === selectedPosition;
    return matchesSearch && matchesPosition;
  });

  const handlePlayerToggle = (playerId: string) => {
    setSelectedPlayerIds((prevSelected) => {
      if (prevSelected.includes(playerId)) {
        // Quitar jugador
        return prevSelected.filter((id) => id !== playerId);
      } else {
        // Añadir jugador, verificando el máximo
        if (maxSelections && prevSelected.length >= maxSelections) {
          return [...prevSelected.slice(1), playerId]; // Quitar el más antiguo y añadir el nuevo
        }
        return [...prevSelected, playerId];
      }
    });
  };

  const handleConfirm = () => {
    const selectedPlayers = players.filter((player) =>
      selectedPlayerIds.includes(player.id)
    );
    onSelect(selectedPlayers);
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50'>
      <div className='bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] flex flex-col'>
        <div className='p-4 border-b'>
          <div className='flex justify-between items-center'>
            <h3 className='text-lg font-medium text-gray-900'>{title}</h3>
            <button
              onClick={onCancel}
              className='text-gray-400 hover:text-gray-600'
            >
              <svg
                className='w-5 h-5'
                xmlns='http://www.w3.org/2000/svg'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          </div>

          {maxSelections && (
            <p className='text-xs text-gray-500 mt-1'>
              Seleccionados: {selectedPlayerIds.length}/{maxSelections}
            </p>
          )}

          {showSearchBox && (
            <div className='mt-3'>
              <input
                type='text'
                placeholder='Buscar jugador...'
                className='w-full px-3 py-2 border border-gray-300 rounded-md text-sm'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}

          {showPositionFilter && uniquePositions.length > 0 && (
            <div className='mt-3 flex flex-wrap gap-1'>
              <button
                onClick={() => setSelectedPosition(null)}
                className={`text-xs px-2 py-1 rounded-full ${
                  selectedPosition === null
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                Todos
              </button>
              {uniquePositions.map((position) => (
                <button
                  key={position}
                  onClick={() =>
                    setSelectedPosition(
                      position === selectedPosition ? null : position
                    )
                  }
                  className={`text-xs px-2 py-1 rounded-full ${
                    position === selectedPosition
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {position}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className='flex-1 overflow-y-auto p-4'>
          {filteredPlayers.length > 0 ? (
            <div className='space-y-3'>
              {filteredPlayers.map((player) => {
                const isSelected = selectedPlayerIds.includes(player.id);
                return (
                  <div
                    key={player.id}
                    onClick={() => handlePlayerToggle(player.id)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border border-blue-200'
                        : 'bg-white border border-gray-100'
                    }`}
                  >
                    <div className='flex items-center'>
                      <div className='w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden mr-3'>
                        {player.avatar ? (
                          <img
                            src={player.avatar}
                            alt={player.name}
                            className='w-full h-full object-cover'
                          />
                        ) : (
                          <span className='text-gray-400'>👤</span>
                        )}
                      </div>
                      <div>
                        <div className='text-sm font-medium text-gray-800'>
                          {player.name}
                        </div>
                        <div className='flex items-center gap-2 text-xs text-gray-500'>
                          {player.position && <span>{player.position}</span>}
                          {player.number && <span>#{player.number}</span>}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full border ${
                        isSelected
                          ? 'bg-blue-500 border-blue-500 flex items-center justify-center'
                          : 'border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className='w-4 h-4 text-white'
                          xmlns='http://www.w3.org/2000/svg'
                          fill='none'
                          viewBox='0 0 24 24'
                          stroke='currentColor'
                        >
                          <path
                            strokeLinecap='round'
                            strokeLinejoin='round'
                            strokeWidth={2}
                            d='M5 13l4 4L19 7'
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className='text-center py-8 text-gray-500'>
              No se encontraron jugadores
            </div>
          )}
        </div>

        <div className='p-4 border-t flex justify-end gap-2'>
          <button
            onClick={onCancel}
            className='px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50'
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedPlayerIds.length === 0}
            className={`px-4 py-2 rounded-md text-sm text-white ${
              selectedPlayerIds.length === 0
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
