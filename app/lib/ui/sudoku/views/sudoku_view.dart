import 'package:sudoku_app/routing/routes.dart';
import 'package:sudoku_app/ui/core/app_theme.dart';
import 'package:sudoku_app/ui/core/icons/app_icons.dart';
import 'package:sudoku_app/ui/core/spacing/app_spacing.dart';
import 'package:sudoku_app/ui/core/widgets/app_icon.dart';
import 'package:sudoku_app/ui/core/widgets/shared_page_layout.dart';
import 'package:sudoku_app/ui/sudoku/state/puzzle/puzzle_bloc.dart';
import 'package:sudoku_app/ui/sudoku/state/timer/timer_bloc.dart';
import 'package:sudoku_app/ui/sudoku/widgets/controls/control_panel.dart';
import 'package:sudoku_app/ui/sudoku/widgets/controls/numpad.dart';
import 'package:sudoku_app/ui/sudoku/widgets/puzzle/info_bar.dart';
import 'package:sudoku_app/ui/sudoku/widgets/puzzle/puzzle_widget.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

class SudokuView extends StatelessWidget {
  const SudokuView({super.key});
  @override
  Widget build(BuildContext context) {
    final title = context.select<PuzzleBloc, String>((bloc) {
      final state = bloc.state;
      if (state is PuzzlePlayingState) {
        return state.rating.toString();
      } else {
        return 'Sudoku';
      }
    });
    return SharedPageLayout(
      title: title,
      trailing: CupertinoButton(
        padding: EdgeInsets.zero,
        child: const AppIcon(AppIcons.settings),
        onPressed: () {
          context.read<TimerBloc>().add(const TimerPaused());
          context.push(Routes.pauseMenu);
        },
      ),
      child: BlocListener<PuzzleBloc, PuzzleState>(
        listener: (context, state) {
          final timerBloc = context.read<TimerBloc>();
          if (timerBloc.state is TimerInitialState &&
              state is PuzzlePlayingState) {
            timerBloc.add(const TimerStarted());
          }
        },
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
