ORM_USER = openrailwaymap
ORM_GROUP = openrailwaymap
TILESERVER_BASEDIR = $(CURDIR)

.PHONY: clean

clean:
	find . -name '*.pyc' -exec rm {} +

install-systemd:
	install -D orm-tileserver.service $(DESTDIR)/etc/systemd/system/orm-tileserver.service
	sed 's/@@ORM_USER@@/$(ORM_USER)/g;s/@@ORM_GROUP@@/$(ORM_GROUP)/g;s#@@TILESERVER_BASEDIR@@#$(TILESERVER_BASEDIR)#g' -i \
		$(DESTDIR)/etc/systemd/system/orm-tileserver.service
