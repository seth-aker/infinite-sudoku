import 'package:infinite_sudoku/domain/models/action.dart';
import 'package:infinite_sudoku/domain/models/cell.dart';
import 'package:infinite_sudoku/domain/models/difficulty.dart';
import 'package:infinite_sudoku/data/model/puzzle/puzzle_dto.dart';
import 'package:infinite_sudoku/utils/serilization.dart';

class Puzzle {
  final String puzzleId;

  final DifficultyRating rating;

  final int score;

  final List<Cell> cells;

  final List<Cell> orginalCells;

  final List<Action> actions;

  final int elapsedSeconds;

  final bool isCompleted;

  const Puzzle({
    required this.puzzleId,
    required this.rating,
    required this.score,
    required this.cells,
    required this.orginalCells,
    required this.actions,
    required this.elapsedSeconds,
    this.isCompleted = false,
  });

  factory Puzzle.fromNewPuzzleDto(NewPuzzleDTO dto) {
    final cells = PuzzleSerializer.deserializeCells(dto.cells, null);
    return Puzzle(
      puzzleId: dto.puzzleId,
      rating: dto.rating,
      score: dto.score,
      cells: cells,
      orginalCells: [...cells],
      actions: [],
      elapsedSeconds: 0,
    );
  }

  factory Puzzle.fromUserPuzzleDto(UserPuzzleDTO dto) {
    final cells = PuzzleSerializer.deserializeCells(dto.cells, dto.candidates);
    final originalCells = PuzzleSerializer.deserializeCells(
      dto.originalCells,
      null,
    );
    final actions =
        dto.actions?.map(PuzzleSerializer.deserializeAction).toList() ??
        const <Action>[];

    return Puzzle(
      puzzleId: dto.puzzleId,
      rating: dto.rating,
      score: dto.score,
      cells: cells,
      orginalCells: originalCells,
      actions: actions,
      elapsedSeconds: dto.time,
    );
  }
}
