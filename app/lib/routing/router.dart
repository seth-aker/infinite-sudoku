import 'package:infinite_sudoku/routing/routes.dart';
import 'package:infinite_sudoku/ui/home/views/home_view.dart';
import 'package:infinite_sudoku/ui/sudoku/views/sudoku_view.dart';
import 'package:infinite_sudoku/ui/sudoku/views/pause_menu.dart';
import 'package:infinite_sudoku/ui/user/views/login_register_view.dart';
import 'package:infinite_sudoku/ui/user/views/user_settings_view.dart';
import 'package:go_router/go_router.dart';

GoRouter router() => GoRouter(
  initialLocation: Routes.home,
  routes: [
    GoRoute(path: Routes.home, builder: (context, state) => const HomeView()),
    GoRoute(
      path: Routes.settings,
      builder: (context, state) => const UserSettingsView(),
    ),
    GoRoute(
      path: Routes.sudoku,
      builder: (context, state) => const SudokuView(),
    ),
    GoRoute(
      path: Routes.login,
      builder: (context, state) => LoginRegisterView(),
    ),
    GoRoute(
      path: Routes.pauseMenu,
      builder: (context, state) => const PauseMenu(),
    ),
  ],
  //   name: 'About',
  //   path: Routes.about,
  //   builder:(context, state) => AboutView(),
  // )
);

// Future<String?> _redirect(BuildContext context, GoRouterState state) async {
//   // if the user is not logged in, they need to login
//   final loggedIn = await context.read<AuthRepository>().isAuthenticated;
//   final loggingIn = state.matchedLocation == Routes.login;
//   if (!loggedIn) {
//     return Routes.login;
//   }

//   // if the user is logged in but still on the login page, send them to
//   // the home page
//   if (loggingIn) {
//     return Routes.home;
//   }

//   // no need to redirect at all
//   return null;
// }
