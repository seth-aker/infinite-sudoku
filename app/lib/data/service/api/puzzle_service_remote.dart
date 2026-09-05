import 'package:sudoku_app/data/model/puzzle/puzzle_dto.dart';
import 'package:sudoku_app/data/service/api/api_client.dart';
import 'package:sudoku_app/data/service/api/puzzle_service.dart';
import 'package:sudoku_app/domain/models/difficulty.dart';
import 'package:sudoku_app/domain/models/puzzle.dart';
import 'package:sudoku_app/utils/result.dart';
import 'package:sudoku_app/utils/serilization.dart';

class PuzzleServiceRemote implements PuzzleService {
  PuzzleServiceRemote({required this._client});

  final ApiClient _client;

  @override
  Future<Result<Puzzle>> getNewPuzzle(DifficultyRating difficulty) =>
      _client.send(
        'GET',
        '/api/sudoku/new?difficulty=${difficulty.toString().toLowerCase()}',
        parse: (json) => Puzzle.fromNewPuzzleDto(NewPuzzleDTO.fromJson(json)),
      );

  @override
  Future<Result<Puzzle>> getPuzzle(String puzzleId) => _client.send(
    'GET',
    '/api/sudoku/$puzzleId',
    parse: (json) => Puzzle.fromUserPuzzleDto(UserPuzzleDTO.fromJson(json)),
  );

  @override
  Future<Result<void>> saveProgress(Puzzle state) {
    final serializedCells = PuzzleSerializer.serializeCells(state.cells);
    final actions = state.actions
        .map(PuzzleSerializer.serializeAction)
        .toList();
    return _client.send(
      'PUT',
      '/api/sudoku/${state.puzzleId}',
      expectedStatus: 204,
      body: {
        'puzzleId': state.puzzleId,
        'cells': serializedCells.cells,
        'candidates': serializedCells.candidates,
        'actions': actions,
        'time': state.elapsedSeconds,
        'isCompleted': state.isCompleted,
      },
      parse: (_) {},
    );
  }
}
