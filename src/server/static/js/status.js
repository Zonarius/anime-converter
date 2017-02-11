Vue.component('queued-anime', {
  props: ['anime'],
  methods: {
    deleteAnime: function (anime) {
      fetch("/delete/" + anime.id, {
        credentials: "same-origin"
      }).then(it => it.json())
        .then(it => {
          if (it.message === "ok") {
            vm.status.queue = it.queue
          }
        })
    }
  },
  template: '<li class="list-group-item"><span class="badge"><a href="#" @click="deleteAnime(anime)"><span class="glyphicon glyphicon-trash" aria-hidden="true"></span></a></span>{{anime.filename}}</li>'
})


var vm = new Vue({
  el: "#app",
  data: {
    status: {}
  },
  computed: {
    percent: function () {
      if (this.status) {
        return Math.round(this.status.currentProgress * 10) / 10;
      } else {
        return 0;
      }
    }
  },
  methods: {
    kill: function () {
      fetch("/kill", {
        credentials: "same-origin"
      }).then(it => it.json())
        .then(it => vm.status = it.status)
    }
  }
});



function fetchStatus() {
  fetch("/status", {
    credentials: "same-origin"
  }).then(it => it.json())
    .then(it => vm.status = it)
}
fetchStatus();
setInterval(fetchStatus, 5000)