import { TeamBuilder } from '../../../lib/teambuilder/TeamBuilder';
import { Member, PlayerRole } from '../../../lib/teambuilder/types';
import { PLAYER_ROLES } from '../../../lib/teambuilder/constants';

describe('TeamBuilder', () => {
  // Utilidades para crear jugadores de prueba
  const createPlayer = (
    id: string,
    name: string,
    primaryRole: PlayerRole,
    secondaryRole: PlayerRole,
    age: number = 25,
    rating: number = 3,
    positionForced: boolean = false
  ): Member => ({
    id,
    name,
    birthdate: new Date(Date.now() - age * 365 * 24 * 60 * 60 * 1000),
    age,
    role: primaryRole,
    playerRoles: [primaryRole, secondaryRole],
    starRating: rating,
    positionForced,
  });

  const createGoalkeeper = (
    id: string,
    name: string,
    age?: number,
    rating?: number
  ) => createPlayer(id, name, 'Arquero', 'Defensor', age, rating);

  const createDefender = (
    id: string,
    name: string,
    age?: number,
    rating?: number
  ) => createPlayer(id, name, 'Defensor', 'Mediocampo', age, rating);

  const createMidfielder = (
    id: string,
    name: string,
    age?: number,
    rating?: number
  ) => createPlayer(id, name, 'Mediocampo', 'Delantero', age, rating);

  const createForward = (
    id: string,
    name: string,
    age?: number,
    rating?: number
  ) => createPlayer(id, name, 'Delantero', 'Mediocampo', age, rating);

  const createWildcard = (
    id: string,
    name: string,
    age?: number,
    rating?: number
  ) => createPlayer(id, name, 'Comodín', 'Mediocampo', age, rating);

  // Utilidad para calcular promedio
  const calculateAverage = (numbers: number[]) =>
    numbers.reduce((a, b) => a + b, 0) / numbers.length;

  // Utilidad para verificar balance entre equipos
  const verifyTeamBalance = (teamA: Member[], teamB: Member[]) => {
    // Verificar arqueros
    expect(
      teamA.some((p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER)
    ).toBeTruthy();
    expect(
      teamB.some((p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER)
    ).toBeTruthy();

    // Verificar balance de edad
    const agesA = teamA.map((p) => p.age || 0);
    const agesB = teamB.map((p) => p.age || 0);
    const avgAgeA = calculateAverage(agesA);
    const avgAgeB = calculateAverage(agesB);
    expect(Math.abs(avgAgeA - avgAgeB)).toBeLessThanOrEqual(5); // Diferencia máxima de 5 años

    // Verificar balance de rating
    const ratingsA = teamA.map((p) => p.starRating || 0);
    const ratingsB = teamB.map((p) => p.starRating || 0);
    const avgRatingA = calculateAverage(ratingsA);
    const avgRatingB = calculateAverage(ratingsB);
    expect(Math.abs(avgRatingA - avgRatingB)).toBeLessThanOrEqual(1); // Diferencia máxima de 1 punto
  };

  describe('Escenarios con menos jugadores de los requeridos', () => {
    test('debería manejar 8 jugadores total (4 vs 4) con balance de edad y rating', () => {
      const players = [
        createGoalkeeper('1', 'Arquero 1', 20, 5),
        createGoalkeeper('2', 'Arquero 2', 35, 3),
        createDefender('3', 'Defensor 1', 25, 4),
        createMidfielder('4', 'Medio 1', 22, 5),
        createForward('5', 'Delantero 1', 28, 3),
        createDefender('6', 'Defensor 2', 30, 4),
        createMidfielder('7', 'Medio 2', 24, 3),
        createForward('8', 'Delantero 2', 26, 5),
      ];

      const teamBuilder = new TeamBuilder(players);
      const [teamA, teamB] = teamBuilder
        .configure({
          balanceByRole: true,
          balanceByAge: true,
          balanceByRating: true,
        })
        .buildTeams();

      expect(teamA.length).toBe(4);
      expect(teamB.length).toBe(4);
      verifyTeamBalance(teamA, teamB);
    });
  });

  describe('Tests de criterios individuales', () => {
    const players = [
      createGoalkeeper('1', 'Arquero 1', 20, 5),
      createGoalkeeper('2', 'Arquero 2', 35, 3),
      createDefender('3', 'Defensor 1', 25, 4),
      createDefender('4', 'Defensor 2', 22, 5),
      createMidfielder('5', 'Medio 1', 28, 3),
      createMidfielder('6', 'Medio 2', 30, 4),
      createForward('7', 'Delantero 1', 24, 3),
      createForward('8', 'Delantero 2', 26, 5),
    ];

    test('debería balancear solo por edad', () => {
      const teamBuilder = new TeamBuilder(players);
      const [teamA, teamB] = teamBuilder
        .configure({
          balanceByRole: false,
          balanceByAge: true,
          balanceByRating: false,
        })
        .buildTeams();

      const avgAgeA = calculateAverage(teamA.map((p) => p.age || 0));
      const avgAgeB = calculateAverage(teamB.map((p) => p.age || 0));
      expect(Math.abs(avgAgeA - avgAgeB)).toBeLessThanOrEqual(5);
    });

    test('debería balancear solo por rating', () => {
      const teamBuilder = new TeamBuilder(players);
      const [teamA, teamB] = teamBuilder
        .configure({
          balanceByRole: false,
          balanceByAge: false,
          balanceByRating: true,
        })
        .buildTeams();

      const avgRatingA = calculateAverage(teamA.map((p) => p.starRating || 0));
      const avgRatingB = calculateAverage(teamB.map((p) => p.starRating || 0));
      expect(Math.abs(avgRatingA - avgRatingB)).toBeLessThanOrEqual(1);
    });

    test('debería balancear solo por rol', () => {
      const teamBuilder = new TeamBuilder(players);
      const [teamA, teamB] = teamBuilder
        .configure({
          balanceByRole: true,
          balanceByAge: false,
          balanceByRating: false,
        })
        .buildTeams();

      // Verificar que cada equipo tenga al menos un jugador de cada rol
      const rolesA = new Set(teamA.map((p) => p.assignedRole));
      const rolesB = new Set(teamB.map((p) => p.assignedRole));

      expect(rolesA.has(PLAYER_ROLES.GOALKEEPER)).toBeTruthy();
      expect(rolesB.has(PLAYER_ROLES.GOALKEEPER)).toBeTruthy();
      expect(rolesA.size).toBeGreaterThanOrEqual(3); // Al menos 3 roles diferentes
      expect(rolesB.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Escenarios con posiciones forzadas', () => {
    test('debería respetar posiciones forzadas', () => {
      const players = [
        // Jugadores con posiciones forzadas
        createPlayer(
          '1',
          'Jugador Forzado 1',
          'Defensor',
          'Mediocampo',
          25,
          4,
          true
        ),
        createPlayer(
          '2',
          'Jugador Forzado 2',
          'Mediocampo',
          'Delantero',
          28,
          3,
          true
        ),
        // Jugadores normales
        createGoalkeeper('3', 'Arquero 1', 22, 4),
        createGoalkeeper('4', 'Arquero 2', 30, 3),
        createDefender('5', 'Defensor 1', 25, 5),
        createMidfielder('6', 'Medio 1', 24, 4),
        createForward('7', 'Delantero 1', 26, 3),
        createWildcard('8', 'Comodín 1', 27, 4),
      ];

      const teamBuilder = new TeamBuilder(players);
      const [teamA, teamB] = teamBuilder
        .configure({
          balanceByRole: true,
          balanceByAge: true,
          balanceByRating: true,
        })
        .buildTeams();

      // Verificar que los jugadores forzados mantienen su rol
      const allPlayers = [...teamA, ...teamB];
      const forcedPlayers = allPlayers.filter((p) => p.positionForced);

      forcedPlayers.forEach((player) => {
        expect(player.assignedRole).toBe(player.role);
      });

      // Verificar balance general
      verifyTeamBalance(teamA, teamB);
    });

    test('debería manejar múltiples posiciones forzadas', () => {
      const players = [
        // Varios jugadores con posiciones forzadas
        createPlayer(
          '1',
          'Defensor Forzado 1',
          'Defensor',
          'Mediocampo',
          25,
          4,
          true
        ),
        createPlayer(
          '2',
          'Defensor Forzado 2',
          'Defensor',
          'Mediocampo',
          28,
          3,
          true
        ),
        createPlayer(
          '3',
          'Medio Forzado 1',
          'Mediocampo',
          'Delantero',
          22,
          5,
          true
        ),
        createPlayer(
          '4',
          'Medio Forzado 2',
          'Mediocampo',
          'Delantero',
          30,
          4,
          true
        ),
        // Jugadores normales para balance
        createGoalkeeper('5', 'Arquero 1', 24, 3),
        createGoalkeeper('6', 'Arquero 2', 26, 4),
        createForward('7', 'Delantero 1', 27, 5),
        createForward('8', 'Delantero 2', 29, 3),
      ];

      const teamBuilder = new TeamBuilder(players);
      const [teamA, teamB] = teamBuilder
        .configure({
          balanceByRole: true,
          balanceByAge: true,
          balanceByRating: true,
        })
        .buildTeams();

      // Verificar que los jugadores forzados mantienen su rol
      const allPlayers = [...teamA, ...teamB];
      const forcedPlayers = allPlayers.filter((p) => p.positionForced);

      forcedPlayers.forEach((player) => {
        expect(player.assignedRole).toBe(player.role);
      });

      // Verificar que hay balance a pesar de las posiciones forzadas
      verifyTeamBalance(teamA, teamB);

      // Verificar distribución equitativa de jugadores forzados
      const forcedInA = teamA.filter((p) => p.positionForced).length;
      const forcedInB = teamB.filter((p) => p.positionForced).length;
      expect(Math.abs(forcedInA - forcedInB)).toBeLessThanOrEqual(1);
    });
  });

  describe('Escenarios sin arquero', () => {
    test('debería asignar arqueros de otros roles', () => {
      const players = [
        createDefender('1', 'Defensor 1'),
        createDefender('2', 'Defensor 2'),
        createMidfielder('3', 'Medio 1'),
        createMidfielder('4', 'Medio 2'),
        createForward('5', 'Delantero 1'),
        createForward('6', 'Delantero 2'),
        createWildcard('7', 'Comodín 1'),
        createWildcard('8', 'Comodín 2'),
      ];

      const teamBuilder = new TeamBuilder(players);
      const [teamA, teamB] = teamBuilder
        .configure({
          balanceByRole: true,
          balanceByAge: true,
          balanceByRating: true,
        })
        .buildTeams();

      // Verificar que se asignaron arqueros
      expect(
        teamA.some((p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER)
      ).toBeTruthy();
      expect(
        teamB.some((p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER)
      ).toBeTruthy();
    });
  });

  describe('Escenario con arqueros solo de rol secundario', () => {
    test('debería priorizar jugadores con rol secundario de arquero', () => {
      const players = [
        createPlayer('1', 'Defensor/Arquero 1', 'Defensor', 'Arquero'),
        createPlayer('2', 'Medio/Arquero 1', 'Mediocampo', 'Arquero'),
        createDefender('3', 'Defensor 2'),
        createMidfielder('4', 'Medio 2'),
        createForward('5', 'Delantero 1'),
        createForward('6', 'Delantero 2'),
        createWildcard('7', 'Comodín 1'),
        createWildcard('8', 'Comodín 2'),
      ];

      const teamBuilder = new TeamBuilder(players);
      const [teamA, teamB] = teamBuilder
        .configure({
          balanceByRole: true,
          balanceByAge: true,
          balanceByRating: true,
        })
        .buildTeams();

      // Verificar que los jugadores con rol secundario de arquero fueron asignados como arqueros
      const goalkeepersAssigned = [
        ...teamA.filter((p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER),
        ...teamB.filter((p) => p.assignedRole === PLAYER_ROLES.GOALKEEPER),
      ];

      expect(goalkeepersAssigned.length).toBe(2);
      expect(
        goalkeepersAssigned.some((p) => p.id === '1' || p.id === '2')
      ).toBeTruthy();
    });
  });

  describe('Escenarios con distintas combinaciones de roles', () => {
    test('debería respetar formación 4-3-3 cuando hay suficientes jugadores', () => {
      const players = [
        createGoalkeeper('1', 'Arquero 1'),
        createGoalkeeper('2', 'Arquero 2'),
        ...Array.from({ length: 8 }, (_, i) =>
          createDefender(`d${i + 1}`, `Defensor ${i + 1}`)
        ),
        ...Array.from({ length: 6 }, (_, i) =>
          createMidfielder(`m${i + 1}`, `Medio ${i + 1}`)
        ),
        ...Array.from({ length: 6 }, (_, i) =>
          createForward(`f${i + 1}`, `Delantero ${i + 1}`)
        ),
      ];

      const teamBuilder = new TeamBuilder(players);
      const [teamA, teamB] = teamBuilder
        .configure({
          balanceByRole: true,
          balanceByAge: true,
          balanceByRating: true,
        })
        .buildTeams();

      // Verificar formación 4-3-3 en ambos equipos
      const countRoles = (team: Member[], role: string) =>
        team.filter((p) => p.assignedRole === role).length;

      expect(countRoles(teamA, PLAYER_ROLES.GOALKEEPER)).toBe(1);
      expect(countRoles(teamA, PLAYER_ROLES.DEFENDER)).toBe(4);
      expect(countRoles(teamA, PLAYER_ROLES.MIDFIELDER)).toBe(3);
      expect(countRoles(teamA, PLAYER_ROLES.FORWARD)).toBe(3);

      expect(countRoles(teamB, PLAYER_ROLES.GOALKEEPER)).toBe(1);
      expect(countRoles(teamB, PLAYER_ROLES.DEFENDER)).toBe(4);
      expect(countRoles(teamB, PLAYER_ROLES.MIDFIELDER)).toBe(3);
      expect(countRoles(teamB, PLAYER_ROLES.FORWARD)).toBe(3);
    });

    test('debería respetar formación 4-4-2 cuando hay suficientes jugadores', () => {
      const players = [
        createGoalkeeper('1', 'Arquero 1'),
        createGoalkeeper('2', 'Arquero 2'),
        ...Array.from({ length: 8 }, (_, i) =>
          createDefender(`d${i + 1}`, `Defensor ${i + 1}`)
        ),
        ...Array.from({ length: 8 }, (_, i) =>
          createMidfielder(`m${i + 1}`, `Medio ${i + 1}`)
        ),
        ...Array.from({ length: 4 }, (_, i) =>
          createForward(`f${i + 1}`, `Delantero ${i + 1}`)
        ),
      ];

      const teamBuilder = new TeamBuilder(players);
      const [teamA, teamB] = teamBuilder
        .configure({
          balanceByRole: true,
          balanceByAge: true,
          balanceByRating: true,
        })
        .buildTeams();

      // Verificar formación 4-4-2 en ambos equipos
      const countRoles = (team: Member[], role: string) =>
        team.filter((p) => p.assignedRole === role).length;

      expect(countRoles(teamA, PLAYER_ROLES.GOALKEEPER)).toBe(1);
      expect(countRoles(teamA, PLAYER_ROLES.DEFENDER)).toBe(4);
      expect(countRoles(teamA, PLAYER_ROLES.MIDFIELDER)).toBe(4);
      expect(countRoles(teamA, PLAYER_ROLES.FORWARD)).toBe(2);

      expect(countRoles(teamB, PLAYER_ROLES.GOALKEEPER)).toBe(1);
      expect(countRoles(teamB, PLAYER_ROLES.DEFENDER)).toBe(4);
      expect(countRoles(teamB, PLAYER_ROLES.MIDFIELDER)).toBe(4);
      expect(countRoles(teamB, PLAYER_ROLES.FORWARD)).toBe(2);
    });
  });

  describe('Tests de formaciones completas', () => {
    test('debería manejar 22 jugadores total (11 vs 11) con balance y formación 4-3-3', () => {
      const players = [
        createGoalkeeper('1', 'Arquero 1', 20, 5),
        createGoalkeeper('2', 'Arquero 2', 35, 3),
        ...Array.from({ length: 8 }, (_, i) =>
          createDefender(`d${i + 1}`, `Defensor ${i + 1}`, 20 + i, 3 + (i % 3))
        ),
        ...Array.from({ length: 6 }, (_, i) =>
          createMidfielder(`m${i + 1}`, `Medio ${i + 1}`, 25 + i, 4 + (i % 2))
        ),
        ...Array.from({ length: 6 }, (_, i) =>
          createForward(`f${i + 1}`, `Delantero ${i + 1}`, 22 + i, 3 + (i % 3))
        ),
      ];

      // Realizar múltiples sorteos y verificar que sean diferentes
      const previousTeams = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const teamBuilder = new TeamBuilder(players);
        const [teamA, teamB] = teamBuilder
          .configure({
            balanceByRole: true,
            balanceByAge: true,
            balanceByRating: true,
          })
          .buildTeams();

        // Verificar tamaño y balance
        expect(teamA.length).toBe(11);
        expect(teamB.length).toBe(11);
        verifyTeamBalance(teamA, teamB);

        // Verificar formación 4-3-3
        const countRoles = (team: Member[], role: string) =>
          team.filter((p) => p.assignedRole === role).length;

        expect(countRoles(teamA, PLAYER_ROLES.GOALKEEPER)).toBe(1);
        expect(countRoles(teamA, PLAYER_ROLES.DEFENDER)).toBe(4);
        expect(countRoles(teamA, PLAYER_ROLES.MIDFIELDER)).toBe(3);
        expect(countRoles(teamA, PLAYER_ROLES.FORWARD)).toBe(3);

        expect(countRoles(teamB, PLAYER_ROLES.GOALKEEPER)).toBe(1);
        expect(countRoles(teamB, PLAYER_ROLES.DEFENDER)).toBe(4);
        expect(countRoles(teamB, PLAYER_ROLES.MIDFIELDER)).toBe(3);
        expect(countRoles(teamB, PLAYER_ROLES.FORWARD)).toBe(3);

        // Verificar que este sorteo sea diferente a los anteriores
        const teamHash = JSON.stringify([
          teamA.map((p) => p.id).sort(),
          teamB.map((p) => p.id).sort(),
        ]);
        expect(previousTeams.has(teamHash)).toBeFalsy();
        previousTeams.add(teamHash);
      }
    });

    test('debería manejar 22 jugadores total (11 vs 11) con balance y formación 4-4-2', () => {
      const players = [
        createGoalkeeper('1', 'Arquero 1', 20, 5),
        createGoalkeeper('2', 'Arquero 2', 35, 3),
        ...Array.from({ length: 8 }, (_, i) =>
          createDefender(`d${i + 1}`, `Defensor ${i + 1}`, 20 + i, 3 + (i % 3))
        ),
        ...Array.from({ length: 8 }, (_, i) =>
          createMidfielder(`m${i + 1}`, `Medio ${i + 1}`, 25 + i, 4 + (i % 2))
        ),
        ...Array.from({ length: 4 }, (_, i) =>
          createForward(`f${i + 1}`, `Delantero ${i + 1}`, 22 + i, 3 + (i % 3))
        ),
      ];

      // Realizar múltiples sorteos y verificar que sean diferentes
      const previousTeams = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const teamBuilder = new TeamBuilder(players);
        const [teamA, teamB] = teamBuilder
          .configure({
            balanceByRole: true,
            balanceByAge: true,
            balanceByRating: true,
          })
          .buildTeams();

        // Verificar tamaño y balance
        expect(teamA.length).toBe(11);
        expect(teamB.length).toBe(11);
        verifyTeamBalance(teamA, teamB);

        // Verificar formación 4-4-2
        const countRoles = (team: Member[], role: string) =>
          team.filter((p) => p.assignedRole === role).length;

        expect(countRoles(teamA, PLAYER_ROLES.GOALKEEPER)).toBe(1);
        expect(countRoles(teamA, PLAYER_ROLES.DEFENDER)).toBe(4);
        expect(countRoles(teamA, PLAYER_ROLES.MIDFIELDER)).toBe(4);
        expect(countRoles(teamA, PLAYER_ROLES.FORWARD)).toBe(2);

        expect(countRoles(teamB, PLAYER_ROLES.GOALKEEPER)).toBe(1);
        expect(countRoles(teamB, PLAYER_ROLES.DEFENDER)).toBe(4);
        expect(countRoles(teamB, PLAYER_ROLES.MIDFIELDER)).toBe(4);
        expect(countRoles(teamB, PLAYER_ROLES.FORWARD)).toBe(2);

        // Verificar que este sorteo sea diferente a los anteriores
        const teamHash = JSON.stringify([
          teamA.map((p) => p.id).sort(),
          teamB.map((p) => p.id).sort(),
        ]);
        expect(previousTeams.has(teamHash)).toBeFalsy();
        previousTeams.add(teamHash);
      }
    });
  });

  describe('Tests de roles secundarios', () => {
    test('debería considerar roles secundarios cuando no hay suficientes jugadores para el rol primario', () => {
      const players = [
        // Solo un arquero natural
        createGoalkeeper('1', 'Arquero 1', 25, 4),
        // Defensor con rol secundario de arquero
        createPlayer('2', 'Defensor/Arquero', 'Defensor', 'Arquero', 28, 3),
        // Resto de jugadores para 4-4-2
        createDefender('3', 'Defensor 1', 22, 5),
        createDefender('4', 'Defensor 2', 24, 4),
        createDefender('5', 'Defensor 3', 26, 3),
        createMidfielder('6', 'Medio 1', 23, 4),
        createMidfielder('7', 'Medio 2', 25, 5),
        createMidfielder('8', 'Medio 3', 27, 3),
        createMidfielder('9', 'Medio 4', 29, 4),
        createForward('10', 'Delantero 1', 24, 5),
        createForward('11', 'Delantero 2', 26, 4),
      ];

      const teamBuilder = new TeamBuilder(players);
      const [teamA, teamB] = teamBuilder
        .configure({
          balanceByRole: true,
          balanceByAge: true,
          balanceByRating: true,
        })
        .buildTeams();

      // Verificar que el defensor con rol secundario de arquero está jugando de arquero en uno de los equipos
      const defensorArquero = players.find((p) => p.id === '2');
      const isPlayingAsGoalkeeper =
        teamA.find((p) => p.id === '2')?.assignedRole === 'Arquero' ||
        teamB.find((p) => p.id === '2')?.assignedRole === 'Arquero';

      expect(isPlayingAsGoalkeeper).toBeTruthy();
      verifyTeamBalance(teamA, teamB);
    });

    test('debería usar roles secundarios para optimizar la formación 4-3-3', () => {
      const players = [
        createGoalkeeper('1', 'Arquero 1', 25, 4),
        createGoalkeeper('2', 'Arquero 2', 28, 3),
        // Defensores con rol secundario de mediocampo
        createPlayer('3', 'Defensor/Medio 1', 'Defensor', 'Mediocampo', 22, 5),
        createPlayer('4', 'Defensor/Medio 2', 'Defensor', 'Mediocampo', 24, 4),
        createPlayer('5', 'Defensor/Medio 3', 'Defensor', 'Mediocampo', 26, 3),
        createPlayer('6', 'Defensor/Medio 4', 'Defensor', 'Mediocampo', 23, 4),
        // Delanteros con rol secundario de mediocampo
        createPlayer(
          '7',
          'Delantero/Medio 1',
          'Delantero',
          'Mediocampo',
          25,
          5
        ),
        createPlayer(
          '8',
          'Delantero/Medio 2',
          'Delantero',
          'Mediocampo',
          27,
          3
        ),
        createPlayer(
          '9',
          'Delantero/Medio 3',
          'Delantero',
          'Mediocampo',
          29,
          4
        ),
        createPlayer(
          '10',
          'Delantero/Medio 4',
          'Delantero',
          'Mediocampo',
          24,
          5
        ),
        createPlayer(
          '11',
          'Delantero/Medio 5',
          'Delantero',
          'Mediocampo',
          26,
          4
        ),
        createPlayer(
          '12',
          'Delantero/Medio 6',
          'Delantero',
          'Mediocampo',
          28,
          3
        ),
        // Mediocampistas puros
        createMidfielder('13', 'Medio 1', 25, 4),
        createMidfielder('14', 'Medio 2', 27, 5),
        createMidfielder('15', 'Medio 3', 23, 3),
        createMidfielder('16', 'Medio 4', 26, 4),
      ];

      const teamBuilder = new TeamBuilder(players);
      const [teamA, teamB] = teamBuilder
        .configure({
          balanceByRole: true,
          balanceByAge: true,
          balanceByRating: true,
        })
        .buildTeams();

      // Verificar formación 4-3-3 en ambos equipos
      const countRoles = (team: Member[], role: PlayerRole) =>
        team.filter((p) => p.assignedRole === role).length;

      expect(countRoles(teamA, 'Arquero')).toBe(1);
      expect(countRoles(teamA, 'Defensor')).toBe(4);
      expect(countRoles(teamA, 'Mediocampo')).toBe(3);
      expect(countRoles(teamA, 'Delantero')).toBe(3);

      expect(countRoles(teamB, 'Arquero')).toBe(1);
      expect(countRoles(teamB, 'Defensor')).toBe(4);
      expect(countRoles(teamB, 'Mediocampo')).toBe(3);
      expect(countRoles(teamB, 'Delantero')).toBe(3);

      verifyTeamBalance(teamA, teamB);
    });

    test('debería usar roles secundarios para optimizar la formación 4-4-2', () => {
      const players = [
        createGoalkeeper('1', 'Arquero 1', 25, 4),
        createGoalkeeper('2', 'Arquero 2', 28, 3),
        // Defensores puros
        createDefender('3', 'Defensor 1', 22, 5),
        createDefender('4', 'Defensor 2', 24, 4),
        createDefender('5', 'Defensor 3', 26, 3),
        createDefender('6', 'Defensor 4', 23, 4),
        // Delanteros con rol secundario de mediocampo
        createPlayer(
          '7',
          'Delantero/Medio 1',
          'Delantero',
          'Mediocampo',
          25,
          5
        ),
        createPlayer(
          '8',
          'Delantero/Medio 2',
          'Delantero',
          'Mediocampo',
          27,
          3
        ),
        createPlayer(
          '9',
          'Delantero/Medio 3',
          'Delantero',
          'Mediocampo',
          29,
          4
        ),
        createPlayer(
          '10',
          'Delantero/Medio 4',
          'Delantero',
          'Mediocampo',
          24,
          5
        ),
        // Mediocampistas puros
        createMidfielder('11', 'Medio 1', 26, 4),
        createMidfielder('12', 'Medio 2', 28, 3),
        createMidfielder('13', 'Medio 3', 25, 4),
        createMidfielder('14', 'Medio 4', 27, 5),
      ];

      const teamBuilder = new TeamBuilder(players);
      const [teamA, teamB] = teamBuilder
        .configure({
          balanceByRole: true,
          balanceByAge: true,
          balanceByRating: true,
        })
        .buildTeams();

      // Verificar formación 4-4-2 en ambos equipos
      const countRoles = (team: Member[], role: PlayerRole) =>
        team.filter((p) => p.assignedRole === role).length;

      expect(countRoles(teamA, 'Arquero')).toBe(1);
      expect(countRoles(teamA, 'Defensor')).toBe(4);
      expect(countRoles(teamA, 'Mediocampo')).toBe(4);
      expect(countRoles(teamA, 'Delantero')).toBe(2);

      expect(countRoles(teamB, 'Arquero')).toBe(1);
      expect(countRoles(teamB, 'Defensor')).toBe(4);
      expect(countRoles(teamB, 'Mediocampo')).toBe(4);
      expect(countRoles(teamB, 'Delantero')).toBe(2);

      verifyTeamBalance(teamA, teamB);
    });
  });
});
