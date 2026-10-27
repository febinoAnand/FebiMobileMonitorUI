// Choose your view (the first page, shared by both views): mobile or web, then that view's login page.

// Mark the view that suits this screen
const suggested = window.matchMedia("(max-width: 700px), (pointer: coarse) and (max-width: 1024px)").matches ? "mobile" : "web";
document.querySelector('[data-suggest="' + suggested + '"]').hidden = false;

document.querySelectorAll("[data-choose-view]").forEach((link) =>
  link.addEventListener("click", (e) => {
    e.preventDefault();
    setView(link.dataset.chooseView);
    location.href = link.dataset.chooseView + "/login.html";
  })
);
