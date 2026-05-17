import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import App from "./App";
import { persistor, store } from "../store/store";

function renderApp() {
  return render(
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <App />
      </PersistGate>
    </Provider>
  );
}

test("renders app branding", () => {
  renderApp();
  expect(screen.getByText("DocPolishAI")).toBeInTheDocument();
});
