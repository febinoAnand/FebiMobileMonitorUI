// Choose View (first page): mobile or web, then the login page.

document.querySelectorAll("[data-choose-view]").forEach((link) =>
  link.addEventListener("click", (e) => {
    e.preventDefault();
    setView(link.dataset.chooseView);
    location.href = "login.html";
  })
);
