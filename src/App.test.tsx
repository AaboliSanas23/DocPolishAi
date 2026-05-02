import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders app branding", () => {
  render(<App />);
  expect(screen.getByText("DocPolishAI")).toBeInTheDocument();
});
