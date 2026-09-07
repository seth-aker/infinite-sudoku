import 'package:infinite_sudoku/data/repositories/puzzle_repository.dart';
import 'package:infinite_sudoku/domain/models/constants/puzzle_constants.dart';
import 'package:infinite_sudoku/domain/models/puzzle.dart';
import 'package:infinite_sudoku/ui/user/state/preferences_cubit.dart';
import 'package:infinite_sudoku/utils/result.dart';
import 'package:infinite_sudoku/domain/models/action.dart';
import 'package:infinite_sudoku/domain/models/cell.dart';
import 'package:infinite_sudoku/domain/models/difficulty.dart';
import 'package:equatable/equatable.dart';
import 'package:hydrated_bloc/hydrated_bloc.dart';

part 'puzzle_state.dart';
part 'puzzle_event.dart';

class PuzzleBloc extends HydratedBloc<PuzzleEvent, PuzzleState> {
  final PuzzleRepository _puzzleRepository;
  final PreferencesCubit _preferencesCubit;
  PuzzleBloc({required this._puzzleRepository, required this._preferencesCubit})
    : super(const PuzzleInitialState()) {
    on<NewPuzzleFetched>(_onNewPuzzleFetched);
    on<PuzzleFetched>(_onPuzzleFetched);
    on<CellSelected>(_onCellSelected);
    on<PencilToggled>(_onPencilToggled);
    on<NumberPressed>(_onNumberPressed);
    on<UndoPressed>(_onUndoPressed);
    on<RedoPressed>(_onRedoPressed);
    on<AutoCandidateModeToggled>(_onAutoCandidateModeToggled);
    on<ResetBoardRequested>(_onResetBoardRequested);
  }

  Future<void> _onNewPuzzleFetched(
    NewPuzzleFetched event,
    Emitter<PuzzleState> emit,
  ) async {
    emit(const PuzzleLoadingState());
    final difficulty = event.difficultyRating;
    // final emptyCells = _generateEmptyCells();
    // emit(
    //   PuzzlePlayingState(
    //     puzzleId: 'test',
    //     rating: difficulty,
    //     score: 0,
    //     cells: emptyCells,
    //     originalCells: [...emptyCells],
    //     history: const [],
    //     elapsedSeconds: 0,
    //   ),
    // );
    // return;
    final result = await _puzzleRepository.getNewPuzzle(difficulty);
    switch (result) {
      case Error<Puzzle>():
        emit(const PuzzleErrorState());
        return;
      case Ok<Puzzle>():
        final puzzle = result.value;

        emit(
          PuzzlePlayingState(
            puzzleId: puzzle.puzzleId,
            rating: puzzle.rating,
            score: puzzle.score,
            cells: puzzle.cells,
            originalCells: puzzle.orginalCells,
            history: puzzle.actions,
            elapsedSeconds: puzzle.elapsedSeconds,
          ),
        );
    }
  }

  Future<void> _onPuzzleFetched(
    PuzzleFetched event,
    Emitter<PuzzleState> emit,
  ) async {
    emit(const PuzzleLoadingState());
    final puzzleId = event.puzzleId;
    final result = await _puzzleRepository.getPuzzle(puzzleId);
    switch (result) {
      case Error<Puzzle>():
        emit(const PuzzleErrorState());
        return;
      case Ok<Puzzle>():
    }
    final puzzle = result.value;
    emit(
      PuzzlePlayingState(
        puzzleId: puzzle.puzzleId,
        rating: puzzle.rating,
        score: puzzle.score,
        cells: puzzle.cells,
        originalCells: puzzle.orginalCells,
        history: puzzle.actions,
        elapsedSeconds: puzzle.elapsedSeconds,
      ),
    );
  }

  void _onCellSelected(CellSelected event, Emitter<PuzzleState> emit) {
    final state = this.state;
    if (state is PuzzlePlayingState) {
      emit(state.copyWith(selectedIdx: event.selectedIdx));
    }
  }

  void _onPencilToggled(PencilToggled event, Emitter<PuzzleState> emit) {
    final state = this.state;
    if (state is PuzzlePlayingState) {
      emit(state.copyWith(usingPencil: !state.usingPencil));
    }
  }

  void _onNumberPressed(NumberPressed event, Emitter<PuzzleState> emit) {
    final state = this.state;
    if (state is! PuzzlePlayingState) return;

    final selectedIdx = state.selectedIdx;
    final value = event.value;
    if (value < 0 ||
        value > 9 ||
        selectedIdx == null ||
        selectedIdx < 0 ||
        selectedIdx > 80) {
      return;
    }

    if (state.originalCells[selectedIdx].value != 0) return;

    if (state.usingPencil) {
      _toggleCandidate(state, selectedIdx, value, emit);
    } else {
      _toggleValue(state, selectedIdx, value, emit);
    }
  }

  void _toggleValue(
    PuzzlePlayingState state,
    int idx,
    int value,
    Emitter<PuzzleState> emit,
  ) {
    final cells = state.cells;
    final originalCells = state.originalCells;
    if (originalCells[idx].value != 0) {
      return;
    }
    final prevCell = cells[idx];
    final history = [...state.history];
    history.add(Action(cell: prevCell, isParent: true));

    if (prevCell.value != value) {
      // Apply new value to target.
      cells[idx] = prevCell.copyWith(value: value, candidates: const {});

      // Loop through cell peers and remove candidates that equal new value;
      if (_preferencesCubit.state.autoCandidateModeOn) {
        final cellPeers = peers[idx];
        for (final peer in cellPeers) {
          final cell = cells[peer];
          if (cell.idx != idx && cell.candidates.contains(value)) {
            history.add(Action(cell: cell.copyWith(), isParent: false));
            cells[peer] = cell.copyWith(
              candidates: cell.candidates
                  .where((candidate) => candidate != value)
                  .toSet(),
            );
          }
        }
      }
    } else if (prevCell.value == value) {
      cells[idx] = prevCell.copyWith(value: 0);

      if (_preferencesCubit.state.autoCandidateModeOn) {
        final affectedCells = {idx, ...peers[idx]};
        for (final affectedIdx in affectedCells) {
          if (cells[affectedIdx].value != 0) continue;
          final candidates = <int>{};
          for (var c = 1; c <= 9; c++) {
            final cellPeers = peers[affectedIdx];
            if (cellPeers.any((peerIdx) => cells[peerIdx].value == c)) {
              candidates.remove(c);
            } else {
              candidates.add(c);
            }
          }
          history.add(Action(cell: cells[affectedIdx], isParent: false));
          cells[affectedIdx] = cells[affectedIdx].copyWith(
            candidates: candidates,
          );
        }
      }
    }
    emit(
      state.copyWith(
        cells: cells,
        history: history,
        redoActions: const [],
        moveCount: state.moveCount + 1,
      ),
    );
  }

  void _toggleCandidate(
    PuzzlePlayingState state,
    int idx,
    int value,
    Emitter<PuzzleState> emit,
  ) {
    if (state.originalCells[idx].value != 0) {
      return;
    }
    final prevCell = state.cells[idx];
    final candidates = Set<int>.from(prevCell.candidates);
    if (!candidates.contains(value)) {
      candidates.add(value);
    } else {
      candidates.remove(value);
    }
    final cells = List<Cell>.from(state.cells);
    cells[idx] = prevCell.copyWith(candidates: candidates);
    emit(
      state.copyWith(
        cells: cells,
        history: [
          ...state.history,
          Action(cell: prevCell, isParent: true),
        ],
        redoActions: const [],
        moveCount: state.moveCount + 1,
      ),
    );
  }

  void _onUndoPressed(UndoPressed event, Emitter<PuzzleState> emit) {
    final state = this.state;
    if (state is PuzzlePlayingState) {
      final redoActions = [...state.redoActions];
      final cells = List<Cell>.from(state.cells);
      final history = [...state.history];
      var action = history.isNotEmpty ? history.removeLast() : null;
      int? selectedIdx = state.selectedIdx;
      // loop through each action that is not a parent action and add it to the redo stack
      // and then make the change to the cells array.
      while (action != null && !action.isParent) {
        final prevCell = cells[action.cell.idx];
        redoActions.add(Action(cell: prevCell, isParent: false));
        cells[action.cell.idx] = action.cell;
        action = history.isNotEmpty ? history.removeLast() : null;
      }
      // remove the parent action
      if (action != null) {
        final prevCell = cells[action.cell.idx];
        redoActions.add(Action(cell: prevCell, isParent: true));
        cells[action.cell.idx] = action.cell;
        selectedIdx = action.cell.idx;
      }
      emit(
        state.copyWith(
          cells: cells,
          history: history,
          redoActions: redoActions,
          selectedIdx: selectedIdx,
          moveCount: state.moveCount + 1,
        ),
      );
    }
  }

  void _onRedoPressed(RedoPressed event, Emitter<PuzzleState> emit) {
    final state = this.state;
    if (state is PuzzlePlayingState) {
      final cells = List<Cell>.from(state.cells);
      final history = [...state.history];
      final redoActions = [...state.redoActions];
      var action = redoActions.isNotEmpty ? redoActions.removeLast() : null;
      int? selectedIdx = state.selectedIdx;

      if (action != null) {
        final prevCell = cells[action.cell.idx];
        cells[action.cell.idx] = action.cell;
        history.add(Action(cell: prevCell, isParent: true));

        selectedIdx = action.cell.idx;
        action = redoActions.isNotEmpty ? redoActions.removeLast() : null;
      }
      while (action != null && !action.isParent) {
        final prevCell = cells[action.cell.idx];
        cells[action.cell.idx] = action.cell;
        history.add(Action(cell: prevCell, isParent: false));
        action = redoActions.isNotEmpty ? redoActions.removeLast() : null;
      }
      if (action != null) {
        redoActions.add(action);
      }
      emit(
        state.copyWith(
          cells: cells,
          history: history,
          redoActions: redoActions,
          selectedIdx: selectedIdx,
          moveCount: state.moveCount + 1,
        ),
      );
    }
  }

  void _onAutoCandidateModeToggled(
    AutoCandidateModeToggled event,
    Emitter<PuzzleState> emit,
  ) {
    final state = this.state;
    if (state is PuzzlePlayingState) {
      var cells = state.cells;
      if (event.autoCandidateModeOn) {
        for (var i = 0; i < 81; i++) {
          if (cells[i].value != 0) continue;
          final candidates = <int>{};
          for (var c = 1; c <= 9; c++) {
            final cellPeers = peers[i];
            if (cellPeers.any((idx) => cells[idx].value == c)) {
              candidates.remove(c);
            } else {
              candidates.add(c);
            }
          }
          cells[i] = cells[i].copyWith(candidates: candidates);
        }
      }
      _preferencesCubit.setAutoCandidateMode(autoCandidateMode: event.autoCandidateModeOn);
      emit(
        state.copyWith(
          cells: cells,
        ),
      );
    }
  }

  void _onResetBoardRequested(
    ResetBoardRequested event,
    Emitter<PuzzleState> emit,
  ) {
    final state = this.state;
    if (state is PuzzlePlayingState) {
      // TODO: add changes into undoActions
      emit(state.copyWith(cells: [...state.originalCells], selectedIdx: null));
    }
  }

  // List<Cell> _generateEmptyCells() {
  //   final cells = <Cell>[];
  //   for (var i = 0; i < 81; i++) {
  //     cells.add(
  //       Cell(
  //         idx: i,
  //         value: i == 0 ? 9 : 0,
  //         candidates: {1, 2, 3, 4, 5, 6, 7, 8, 9},
  //       ),
  //     );
  //   }
  //   return cells;
  // }

  @override
  PuzzleState? fromJson(Map<String, dynamic> json) {
    try {
      final type = json['type'];
      switch (type) {
        case 'PuzzlePlayingState':
          return PuzzlePlayingState(
            puzzleId: json['puzzleId'],
            rating: DifficultyRating.fromString(json['rating']),
            score: json['score'] as int,
            cells: (json['cells'] as List)
                .map((e) => Cell.fromJson(e))
                .toList(),
            originalCells: (json['originalCells'] as List)
                .map((e) => Cell.fromJson(e))
                .toList(),
            history: (json['history'] as List)
                .map((e) => Action.fromJson(e))
                .toList(),
            elapsedSeconds: json['elapsedSeconds'] as int,
            redoActions: (json['redoActions'] as List)
                .map((e) => Action.fromJson(e))
                .toList(),
            isCompleted: json['isCompleted'] as bool,
            usingPencil: json['usingPencil'] as bool,
            selectedIdx: json['selectedIdx'] as int,
            moveCount: json['moveCount'] as int,
          );
        case 'PuzzleLoadingState':
        case 'PuzzleErrorState':
        default:
          return const PuzzleInitialState();
      }
    } catch (e) {
      // TODO: Implement Error handling
      return null;
    }
  }

  @override
  Map<String, dynamic>? toJson(PuzzleState state) {
    try {
      switch (state) {
        case PuzzlePlayingState():
          return {
            'type': 'PuzzlePlayingState',
            'puzzleId': state.puzzleId,
            'rating': state.rating.toString(),
            'score': state.score,
            'cells': state.cells.map((c) => c.toJson()).toList(),
            'originalCells': state.originalCells
                .map((e) => e.toJson())
                .toList(),
            'history': state.history.map((e) => e.toJson()).toList(),
            'redoActions': state.redoActions.map((e) => e.toJson()).toList(),
            'elapsedSeconds': state.elapsedSeconds,
            'isCompleted': state.isCompleted,
            'usingPencil': state.usingPencil,
            'selectedIdx': state.selectedIdx,
            'moveCount': state.moveCount,
          };
        case PuzzleInitialState():
          return {'type': 'PuzzleInitialState'};
        case PuzzleLoadingState():
          return {'type': 'PuzzleLoadingState'};
        case PuzzleErrorState():
          return {'type': 'PuzzleErrorState'};
      }
    } catch (e) {
      return null;
    }
  }
}
