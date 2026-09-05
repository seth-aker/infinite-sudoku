import 'package:sudoku_app/data/service/api/puzzle_service.dart';
import 'package:sudoku_app/domain/models/difficulty.dart';
import 'package:sudoku_app/domain/models/puzzle.dart';
import 'package:sudoku_app/utils/result.dart';

class PuzzleRepository {
  const PuzzleRepository({required this._puzzleService});

  final PuzzleService _puzzleService;

  Future<Result<Puzzle>> getNewPuzzle(DifficultyRating difficulty) =>
      _puzzleService.getNewPuzzle(difficulty);

  Future<Result<Puzzle>> getPuzzle(String puzzleId) =>
      _puzzleService.getPuzzle(puzzleId);

  Future<Result<void>> saveProgress(Puzzle state) =>
      _puzzleService.saveProgress(state);
}
