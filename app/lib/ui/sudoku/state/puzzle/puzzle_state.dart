part of 'puzzle_bloc.dart';

enum PuzzleStatus {
  initial,
  loading,
  loaded,
  error;

  static PuzzleStatus fromJson(String json) {
    switch (json) {
      case 'initial':
        return .initial;
      case 'loading':
        return .loading;
      case 'loaded':
        return .loaded;
      case 'error':
      default:
        return .error;
    }
  }
}

class PuzzleState extends Equatable {
  final PuzzleStatus status;

  final String? errorMessage;

  final Puzzle? puzzle;

  final int? selectedIdx;

  final bool usingPencil;

  final int moveCount;

  const PuzzleState({
    required this.status,
    this.errorMessage,
    this.puzzle,
    this.usingPencil = false,
    this.selectedIdx,
    this.moveCount = 0,
  });
  PuzzleState copyWith({
    List<Cell>? cells,
    List<Action>? history,
    List<Action>? redoActions,
    PuzzleStatus? status,
    String? errorMessage,
    int? elapsedSeconds,
    int? selectedIdx,
    bool? usingPencil,
    int? moveCount,
  }) {
    final puzzle = this.puzzle;
    return PuzzleState(
      status: status ?? this.status,
      puzzle: puzzle?.copyWith(
        cells: cells ?? puzzle.cells,
        history: history ?? puzzle.history,
        elapsedSeconds: elapsedSeconds ?? puzzle.elapsedSeconds,
      ),
      usingPencil: usingPencil ?? this.usingPencil,
      selectedIdx: selectedIdx ?? this.selectedIdx,
      moveCount: moveCount ?? this.moveCount,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }

  factory PuzzleState.initial() => PuzzleState(status: .initial);

  @override
  List<Object?> get props => [
    status,
    errorMessage,
    puzzle,
    selectedIdx,
    usingPencil,
    moveCount,
  ];
}
