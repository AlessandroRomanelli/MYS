$(document).ready(function() {
  if (window.location.pathname == "/search/movies") {
    let qs = window.location.search.split('&');
    let curPage = qs[1].split('=')[1];
    curPage = parseInt(curPage);
    let maxPage = parseInt($('.max-pages').text().split(' ')[4]);
    $(`.page-link[href="${curPage}"]`).parent().addClass('active');
    $('.pagination').children().each(function(index) {
      if (parseInt($(this).children().text()) > maxPage) {
        $(this).addClass('disabled');
      } else {
        $(this).removeClass('disabled');
      }
      if (curPage === 1) {
        $('.page-link[aria-label="Previous"]').parent().addClass('disabled');
      } else {
        $('.page-link[aria-label="Previous"]').parent().removeClass('disabled');
      }
      if (curPage === maxPage) {
        $('.page-link[aria-label="Next"]').parent().addClass('disabled');
      } else {
        $('.page-link[aria-label="Next"]').parent().removeClass('disabled');
      }
      $(this).children().click(function(event) {
        event.preventDefault();
        let path = `http://${window.location.host}${window.location.pathname}`;
        if ($(this).text() === "«Previous") {
          let prevPage = curPage-1;
          if (prevPage < 1) {
            return true
          } else {
            let string = `${qs[0]}&page=${prevPage}`;
            path += string;
            return window.location.href = path;
          }
        } else if ($(this).text() === "»Next") {
          let nextPage = curPage+1;
          if (nextPage > maxPage) {
            console.log("Page doesn't exist!")
          } else {
            let string = `${qs[0]}&page=${nextPage}`;
            path += string;
            return window.location.href = path;
          }
          return true
        } else if (parseInt($(this).text()) > maxPage) {
          console.log("Page doesn't exist!");
        }
        let string = `${qs[0]}&page=${$(this).text()}`;
        path += string;
        window.location.href = path;
      })
    });
  }
});
