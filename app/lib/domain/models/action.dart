import 'package:infinite_sudoku/domain/models/cell.dart';
import 'package:equatable/equatable.dart';

class Action extends Equatable {
  final Cell cell;

  final bool isParent;

  const Action({required this.cell, required this.isParent});

  @override
  List<Object?> get props => [cell, isParent];

  factory Action.fromJson(Map<String, dynamic> json) {
    return Action(
      cell: Cell.fromJson(json['cell']),
      isParent: json['isParent'] as bool,
    );
  }

  Map<String, dynamic> toJson() {
    return {'cell': cell.toJson(), 'isParent': isParent};
  }
}
