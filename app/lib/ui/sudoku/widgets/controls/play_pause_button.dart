import 'package:infinite_sudoku/ui/core/constants.dart';
import 'package:infinite_sudoku/ui/core/widgets/button.dart';
import 'package:infinite_sudoku/ui/sudoku/state/timer/timer_bloc.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

class PlayPauseButton extends StatelessWidget {
  const PlayPauseButton({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<TimerBloc, TimerState>(
      builder: (context, timerState) {
        return switch (timerState) {
          TimerPausedState() => Button.icon(
            onPressed: () =>
                context.read<TimerBloc>().add(const TimerResumed()),
            child: isApple
                ? const Icon(CupertinoIcons.play_arrow)
                : const Icon(Icons.play_arrow),
          ),
          TimerPlayingState() => Button.icon(
            onPressed: () => context.read<TimerBloc>().add(const TimerPaused()),
            child: isApple
                ? const Icon(CupertinoIcons.pause)
                : const Icon(Icons.pause),
          ),
          _ => Button.icon(
            onPressed: null,
            child: isApple
                ? const Icon(CupertinoIcons.play_arrow)
                : const Icon(Icons.play_arrow),
          ),
        };
      },
    );
  }
}
