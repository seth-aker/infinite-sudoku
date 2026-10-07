import 'package:infinite_sudoku/routing/routes.dart';
import 'package:infinite_sudoku/ui/core/app_theme.dart';
import 'package:infinite_sudoku/ui/core/icons/app_icons.dart';
import 'package:infinite_sudoku/ui/core/spacing/app_spacing.dart';
import 'package:infinite_sudoku/ui/core/widgets/app_icon.dart';
import 'package:infinite_sudoku/ui/core/widgets/shared_page_layout.dart';
import 'package:infinite_sudoku/ui/sudoku/state/puzzle/puzzle_bloc.dart';
import 'package:infinite_sudoku/ui/sudoku/state/timer/timer_bloc.dart';
import 'package:infinite_sudoku/ui/sudoku/views/puzzle_complete_view.dart';
import 'package:infinite_sudoku/ui/sudoku/widgets/controls/control_panel.dart';
import 'package:infinite_sudoku/ui/sudoku/widgets/controls/numpad.dart';
import 'package:infinite_sudoku/ui/sudoku/widgets/puzzle/info_bar.dart';
import 'package:infinite_sudoku/ui/sudoku/widgets/puzzle/puzzle_widget.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

class SudokuView extends StatefulWidget {
  const SudokuView({super.key});

  @override
  State<SudokuView> createState() => _SudokuViewState();
}

class _SudokuViewState extends State<SudokuView> with RouteAware {
  // store references to these objects so they can be used in the dispose method.
  late TimerBloc _timerBloc;
  late PuzzleBloc _puzzleBloc;
  late RouteObserver<ModalRoute<dynamic>> _routeObserver;
  @override
  void initState() {
    final puzzleState = context.read<PuzzleBloc>().state;
    if (puzzleState.status == .loaded) {
      context.read<TimerBloc>().add(
        TimerStarted(seconds: puzzleState.puzzle?.elapsedSeconds ?? 0),
      );
    }
    super.initState();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _timerBloc = context.read<TimerBloc>();
    _puzzleBloc = context.read<PuzzleBloc>();
    _routeObserver = context.read<RouteObserver<ModalRoute<dynamic>>>();
    _routeObserver.subscribe(this, ModalRoute.of(context)!);
  }

  @override
  void didPopNext() {
    final puzzleState = context.read<PuzzleBloc>().state;
    if (puzzleState.status == .loaded) {
      context.read<TimerBloc>().add(
        TimerStarted(seconds: puzzleState.puzzle?.elapsedSeconds ?? 0),
      );
    }
    super.didPopNext();
  }

  @override
  void dispose() {
    _timerBloc.add(const TimerPaused());
    final puzzle = _puzzleBloc.state.puzzle;
    if (_puzzleBloc.state.status == .loaded && puzzle != null) {
      _puzzleBloc.add(
        SavePuzzleRequested(elapsedSeconds: _timerBloc.state.elapsedSeconds),
      );
    }
    _routeObserver.unsubscribe(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final title = context.select<PuzzleBloc, String>((bloc) {
      final state = bloc.state;
      if (state.status == .loaded) {
        return state.puzzle?.rating.toString() ?? 'Loading';
      } else {
        return 'Loading';
      }
    });
    return SharedPageLayout(
      title: title,
      trailing: CupertinoButton(
        padding: EdgeInsets.zero,
        child: const AppIcon(AppIcons.pause),
        onPressed: () {
          final timerBloc = context.read<TimerBloc>();
          timerBloc.add(const TimerPaused());
          context.read<PuzzleBloc>().add(
            SavePuzzleRequested(elapsedSeconds: timerBloc.state.elapsedSeconds),
          );
          context.push(Routes.pauseMenu);
        },
      ),
      child: MultiBlocListener(
        listeners: [
          // Start Timer Listener
          BlocListener<PuzzleBloc, PuzzleState>(
            listener: (context, state) {
              context.read<TimerBloc>().add(
                TimerStarted(
                  seconds: state.puzzle != null
                      ? state.puzzle!.elapsedSeconds
                      : 0,
                ),
              );
            },
            listenWhen: ((previous, current) =>
                current.status == .loaded &&
                (previous.status != .loaded ||
                    previous.puzzle?.puzzleId != current.puzzle?.puzzleId)),
          ),
          // Puzzle Completed Listener
          BlocListener<PuzzleBloc, PuzzleState>(
            listener: ((context, state) {
              if (state.puzzle != null) {
                final timberBloc = context.read<TimerBloc>();
                final elapsedSeconds = timberBloc.state.elapsedSeconds;
                timberBloc.add(const TimerPaused());
                context.read<PuzzleBloc>().add(
                  SavePuzzleRequested(elapsedSeconds: elapsedSeconds),
                );
                showPuzzleCompleteDialog(context);
              }
            }),
            listenWhen: ((previous, current) {
              final prev = previous.puzzle;
              final curr = current.puzzle;
              return (prev != null &&
                  curr != null &&
                  (!prev.isComplete && curr.isComplete));
            }),
          ),
        ],
        child: ColoredBox(
          color: AppTheme.background(context),
          child: Column(
            children: [
              InfoBar(),
              Align(
                alignment: AlignmentGeometry.topCenter,
                child: AspectRatio(aspectRatio: 1, child: const PuzzleWidget()),
              ),
              ControlPanel(),
              Expanded(
                child: SizedBox(
                  width:
                      AppSpacing.four * 3 +
                      AppSpacing.half *
                          2, // AppSpacing.four sized buttons + AppSpacing.half * 2
                  child: Numpad(
                    onTap: (value) => context.read<PuzzleBloc>().add(
                      NumberPressed(value: value),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
