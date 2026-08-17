import { Chess, type Square } from "chess.js";

const whitePieces: Record<string, string> = {
  p: "♙",
  r: "♖",
  n: "♘",
  b: "♗",
  q: "♕",
  k: "♔",
};

const blackPieces: Record<string, string> = {
  p: "♟",
  r: "♜",
  n: "♞",
  b: "♝",
  q: "♛",
  k: "♚",
};

export function parseFenBoard(fen: string) {
  const [board] = fen.split(" ");
  const rows = board.split("/");
  return rows.flatMap((row, rowIndex) => {
    const squares: Array<{
      square: string;
      piece: string | null;
      color: "light" | "dark";
    }> = [];
    let fileIndex = 0;

    for (const char of row) {
      if (Number.isInteger(Number(char))) {
        const emptyCount = Number(char);
        for (let i = 0; i < emptyCount; i += 1) {
          const square = `${String.fromCharCode(97 + fileIndex)}${8 - rowIndex}`;
          squares.push({
            square,
            piece: null,
            color: (rowIndex + fileIndex) % 2 === 0 ? "light" : "dark",
          });
          fileIndex += 1;
        }
      } else {
        const lower = char.toLowerCase();
        const square = `${String.fromCharCode(97 + fileIndex)}${8 - rowIndex}`;
        squares.push({
          square,
          piece: char === lower ? blackPieces[lower] : whitePieces[lower],
          color: (rowIndex + fileIndex) % 2 === 0 ? "light" : "dark",
        });
        fileIndex += 1;
      }
    }

    return squares;
  });
}

export function legalTargets(fen: string, square: string) {
  const chess = new Chess(fen);
  return chess
    .moves({ square: square as Square, verbose: true })
    .map((move) => ("to" in move ? move.to : move));
}

export function playMove(fen: string, from: string, to: string) {
  const chess = new Chess(fen);
  const result = chess.move({ from, to, promotion: "q" });
  if (!result) {
    return null;
  }
  return {
    fen: chess.fen(),
    san: result.san,
    turn: chess.turn(),
    checkmate: chess.isCheckmate(),
    check: chess.inCheck(),
  };
}

export function isValidFen(fen: string) {
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

export function pgnToFen(pgn: string) {
  const chess = new Chess();
  chess.loadPgn(pgn);
  return {
    fen: chess.fen(),
    sideToMove: chess.turn(),
  };
}
